#!/usr/bin/env python3
"""Catálogo ABI para el bot de Discord.

Solo librería estándar: descarga data/*.json desde GitHub (raw o Pages),
mantiene índices y construye payloads de embed en dicts planos
(igual que los espera la API de Discord) para poder testear sin discord.py.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import unicodedata
import urllib.request
from collections import defaultdict

DEFAULT_BASES = [
    "https://raw.githubusercontent.com/ElDonConC/abi-build-codes/main/data",
    "https://eldonconc.github.io/abi-build-codes/data",
]
FILES = ("builds", "armas", "sin_build", "lista", "fuentes", "monitor")
MAX_FIELDS = 25
MAX_FIELD_NAME = 102
MAX_FIELD_VALUE = 1024

COLOR_NIVEL = {
    "barata": 0x3FB950,
    "media": 0xD29922,
    "premium": 0xA371F7,
}
COLOR_DEFAULT = 0x4CC2FF
COLOR_AVISO = 0xD29922

VERIF_TEXTO = {
    "presente": "verificado en su fuente",
    "ausente": "hoy no aparece en su fuente",
    "fuente_bloqueada": "fuente bloqueada ahora",
    "fuente_error": "fuente con error",
}


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip().lower()


def clave_busq(text: str) -> str:
    """Igual que norm pero con guiones como espacio: 'ak 12' encuentra 'AK-12'."""
    return norm(text).replace("-", " ").replace("(", " ").replace(")", " ")


def koen(n) -> str:
    if n is None:
        return "sin precio publicado"
    return f"{n:,}".replace(",", ".") + " Koen"


def fetch_json(url: str, timeout=20):
    if not url.startswith(("http://", "https://")):
        import pathlib
        return json.loads(pathlib.Path(url).read_text(encoding="utf-8"))
    req = urllib.request.Request(url, headers={"User-Agent": "abi-discord-bot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


class Catalogo:
    def __init__(self, bases=None, ttl_seconds=6 * 3600):
        self.bases = list(bases or DEFAULT_BASES)
        self.ttl = ttl_seconds
        self._cargado_en = 0.0
        self.builds = []
        self.armas = []
        self.sin_build = []
        self.monitor = None
        self._builds_por_arma = defaultdict(list)
        self._arma_por_norm = {}
        self._clases = defaultdict(list)

    # ---------- carga ----------
    def load(self, force=False):
        import time
        if not force and self.builds and time.time() - self._cargado_en < self.ttl:
            return self
        last_error = None
        for base in self.bases:
            try:
                data = {name: fetch_json(f"{base}/{name}.json") for name in FILES}
                self.builds = data["builds"]
                self.armas = data["armas"]
                self.sin_build = data["sin_build"]
                self.monitor = data["monitor"]
                self._indexar()
                self._cargado_en = time.time()
                return self
            except Exception as e:  # base caída → probamos la siguiente
                last_error = e
        raise RuntimeError(f"No se pudo cargar el catálogo: {last_error}")

    def _indexar(self):
        self._builds_por_arma = defaultdict(list)
        self._arma_por_norm = {}
        self._clases = defaultdict(list)
        for b in self.builds:
            self._builds_por_arma[b["arma"]].append(b)
        for a in self.armas:
            self._arma_por_norm[norm(a["arma"])] = a
            self._clases[a["clase"]].append(a)
        for nombre in list(self._builds_por_arma):
            if norm(nombre) not in self._arma_por_norm:
                clase = self._builds_por_arma[nombre][0].get("clase") or "Sin clase"
                self._arma_por_norm[norm(nombre)] = {"arma": nombre, "clase": clase}
        for lista in self._clases.values():
            lista.sort(key=lambda x: x["arma"])

    # ---------- catálogo ----------
    @property
    def nombres_armas(self):
        return sorted(a["arma"] for a in self._arma_por_norm.values())

    @property
    def clases(self):
        return sorted(self._clases)

    def opciones_autocomplete(self, current: str, limite=MAX_FIELDS):
        q = clave_busq(current)
        con_builds = {clave_busq(b["arma"]) for b in self.builds}
        candidatos = [(a["arma"], clave_busq(a["arma"])) for a in self._arma_por_norm.values()]
        if q:
            prefijo = [n for n, k in candidatos if k.startswith(q)]
            dentro = [n for n, k in candidatos if q in k and not k.startswith(q)]
            orden = sorted(prefijo) + sorted(dentro)
        else:
            orden = [n for n, k in sorted(candidatos, key=lambda t: t[1])]
        orden.sort(key=lambda n: (clave_busq(n) not in con_builds, n))
        return orden[:limite]

    def buscar(self, nombre: str):
        arma = self._arma_por_norm.get(norm(nombre))
        if arma:
            return arma
        q = clave_busq(nombre)
        for clave, a in self._arma_por_norm.items():
            if clave_busq(a["arma"]) == q:
                return a
        return None

    def builds_de(self, nombre: str):
        filas = list(self._builds_por_arma.get(nombre, []))
        filas.sort(key=lambda b: (b.get("precio_ref") or b.get("precio_min") or 10**12, b.get("etiqueta") or ""))
        return filas

    def verif(self, build_id):
        if not self.monitor:
            return None
        for c in self.monitor.get("codigos", []):
            if c["build_id"] == build_id:
                return c
        return None

    def resumen_monitor(self):
        if not self.monitor:
            return "Comprobación de fuentes no disponible"
        r = self.monitor.get("resumen", {})
        fecha = (self.monitor.get("updated_at") or "")[:16].replace("T", " ")
        return (f"Comprobado {fecha} UTC · fuentes OK "
                f"{r.get('fuentes_ok', '?')}/{r.get('fuentes_total', '?')} · "
                f"códigos presentes {r.get('codigos_presentes', '?')}")

    # ---------- payloads ----------
    def _color_de_nivel(self, niveles):
        for n in ("premium", "media", "barata"):
            if any(norm(x).startswith(n) for x in niveles if x):
                return COLOR_NIVEL[n]
        return COLOR_DEFAULT

    def embed_arma(self, nombre: str):
        arma = self.buscar(nombre)
        if not arma:
            similares = self.opciones_autocomplete(nombre, 5)
            sugerencia = " · " + ", ".join(similares) if similares else ""
            return {
                "title": "Arma no encontrada",
                "description": f"No tengo `{nombre}` en el catálogo{sugerencia}",
                "color": COLOR_AVISO,
                "fields": [],
                "footer": {"text": "Usa el autocompletado de /arma"},
            }
        nombre = arma["arma"]
        filas = self.builds_de(nombre)
        fields = []
        if filas:
            precios = [f.get("precio_ref") or f.get("precio_min") for f in filas]
            con_precio = [p for p in precios if p]
            desc_parts = [f"**{len(filas)}** configuraciones en el catálogo"]
            if con_precio:
                desc_parts.append(f"desde {koen(min(con_precio))}")
            if arma.get("estado"):
                desc_parts.append(arma["estado"])
            description = " · ".join(desc_parts)[:4096]
            for i, b in enumerate(filas[:MAX_FIELDS], start=1):
                etiqueta = b.get("etiqueta") or "Configuración"
                nivel = b.get("nivel") or "Sin nivel"
                verif = self.verif(b["id"])
                extra = ""
                if verif and verif.get("resultado") in VERIF_TEXTO:
                    extra = f"\n_{VERIF_TEXTO[verif['resultado']]}_"
                value = f"Precio: {koen(b.get('precio_ref') or b.get('precio_min'))}\n" \
                        f"```{b.get('codigo') or 'sin código'}```{extra}"
                fields.append({
                    "name": f"{i}. {etiqueta} — {nivel}"[:MAX_FIELD_NAME],
                    "value": value[:MAX_FIELD_VALUE],
                })
            if len(filas) > MAX_FIELDS:
                fields[-1] = {
                    "name": "…y más",
                    "value": f"Faltan {len(filas) - MAX_FIELDS} configuraciones. "
                             "Consulta la web del catálogo.",
                    "inline": False,
                }
        else:
            description = ("Todavía sin códigos en el catálogo. "
                           "Puede que aparezcan en próximas temporadas.")
            if arma.get("fuente_roster"):
                fields.append({"name": "Fuente del roster",
                              "value": arma["fuente_roster"][:MAX_FIELD_VALUE]})
        payload = {
            "title": f"{nombre} · {arma.get('clase', '')}"[:256],
            "description": description[:4096],
            "color": self._color_de_nivel([f.get("nivel", "") for f in filas]) if filas else COLOR_AVISO,
            "fields": fields,
            "url": "https://eldonconc.github.io/abi-build-codes/#builds",
            "footer": {"text": self.resumen_monitor()[:2048]},
        }
        return payload

    def embed_clase(self, clase: str):
        armas = self._clases.get(clase, [])
        resto = max(0, len(armas) - MAX_FIELDS)
        visibles = armas[:MAX_FIELDS - (1 if resto else 0)]
        fields = []
        for a in visibles:
            n = len(self._builds_por_arma.get(a["arma"], []))
            valor = f"{n} builds" if n else "sin builds todavía"
            if a.get("precio_min"):
                valor += f" · desde {koen(a['precio_min'])}"
            fields.append({"name": a["arma"], "value": valor, "inline": True})
        if resto > 0:
            fields.append({"name": "…y más", "value": f"{resto} armas más: usa /arma",
                           "inline": False})
        return {
            "title": f"{clase} · {len(armas)} armas"[:256],
            "description": "Elige del menú para ver sus códigos.",
            "color": COLOR_DEFAULT,
            "fields": fields,
            "footer": {"text": self.resumen_monitor()[:2048]},
        }

    def embed_catalogo(self):
        r = (self.monitor or {}).get("resumen", {})
        return {
            "title": "Catálogo ABI · Arena Breakout: Infinite",
            "description": (f"**{len(self.builds)}** configuraciones · **{len(self.armas)}** armas · "
                            f"**{len(self.sin_build)}** armas aún sin código.\n"
                            "Elige una clase en el menú o usa `/arma` con autocompletado."),
            "color": COLOR_DEFAULT,
            "fields": [
                {"name": "Verificado hoy", "value": str(r.get("codigos_presentes", "?")), "inline": True},
                {"name": "No aparecen", "value": str(r.get("codigos_ausentes", "?")), "inline": True},
                {"name": "Candidatos nuevos", "value": str(r.get("candidatos_nuevos", "?")), "inline": True},
            ],
            "url": "https://eldonconc.github.io/abi-build-codes/",
            "footer": {"text": self.resumen_monitor()[:2048]},
        }

    def opciones_clase(self):
        return [{"label": c, "value": c} for c in self.clases[:MAX_FIELDS]]

    def opciones_arma_de_clase(self, clase: str):
        armas = self._clases.get(clase, [])
        armas = sorted(armas, key=lambda a: -len(self._builds_por_arma.get(a["arma"], [])))
        out = []
        for a in armas[:MAX_FIELDS]:
            n = len(self._builds_por_arma.get(a["arma"], []))
            out.append({"label": a["arma"][:100],
                        "value": a["arma"][:100],
                        "description": (f"{n} builds" if n else "sin builds todavía")[:100]})
        return out
