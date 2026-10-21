#!/usr/bin/env python3
"""Descarga miniaturas de las armas a data/img/ y genera data/img.json.

Fuente: Arena Breakout Infinite Wiki (Fandom), vía su API MediaWiki
(action=query&generator=search&prop=pageimages).

Uso:
    python3 scripts/download_imgs.py                # todas (repite las que ya existen)
    python3 scripts/download_imgs.py --solo-faltantes

Las imágenes son assets del juego (MoreFun Studios); este fan site las
usa con atribución a la wiki. Si alguna arma sale con la imagen equivocada
o sin imagen, añade un ajuste en OVERRIDES (nombre del catálogo → búsqueda
o título de la wiki) y vuelve a ejecutar el script.
"""
import json
import pathlib
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "data" / "img"
MAPA = ROOT / "data" / "img.json"
API = "https://arena-breakout-infinite.fandom.com/api.php"
UA = "abi-build-catalog/1.0 (fan catalog; github.com/ElDonConC/abi-build-codes)"
PITHUMBSIZE = 480

# Ajustes manuales: nombre del catálogo → término de búsqueda/título en la wiki
OVERRIDES = {
    "CCZ 52": "CZ52",       # en la wiki es "CZ52 Pistol"
    "Bizon": "PP19",        # en la wiki es "PP19 Micro SMG"
    "PP19-01": "PP19",
    "ZC807": "CZ 807",      # el catálogo escribe ZC807; la wiki, CZ 807
    "M300 (revólver)": "M300",  # el archivo es File:M300.png
}

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", s)


def slug(text):
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    keep = "".join(c if c.isalnum() else "_" for c in text.lower())
    while "__" in keep:
        keep = keep.replace("__", "_")
    return keep.strip("_")


def api(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def buscar_imagen(nombre):
    """Devuelve (url, título de procedencia) o (None, None).

    1) Página de la wiki con miniatura en su infobox — solo si el título
       de la página contiene el arma buscada (evita "T88 → Valley").
    2) Archivo directo del espacio de imágenes (File:AX50.png), que es
       donde están los renders de las páginas sin infobox.
    """
    q = OVERRIDES.get(nombre, nombre)
    nq = norm(q)

    # 1) página con pageimages
    res = api({
        "action": "query", "generator": "search", "gsrsearch": q,
        "gsrlimit": "5", "gsrnamespace": "0", "prop": "pageimages",
        "piprop": "thumbnail", "pithumbsize": str(PITHUMBSIZE),
    })
    pages = list((res.get("query") or {}).get("pages", {}).values())
    con_imagen = [p for p in pages
                  if p.get("thumbnail", {}).get("source") and nq in norm(p["title"])]
    con_imagen.sort(key=lambda p: (0 if norm(p["title"]).startswith(nq) else 1,
                                   p.get("index", 9)))
    if con_imagen:
        top = con_imagen[0]
        return top["thumbnail"]["source"], top["title"]

    # 2) archivo directo (namespace 6)
    res = api({
        "action": "query", "generator": "search", "gsrsearch": q,
        "gsrlimit": "6", "gsrnamespace": "6", "prop": "imageinfo",
        "iiprop": "url", "iiurlwidth": str(PITHUMBSIZE),
    })
    candidatos = []
    for p in (res.get("query") or {}).get("pages", {}).values():
        titulo = p.get("title", "")
        nombre_arch = titulo[5:] if titulo.startswith("File:") else titulo
        if pathlib.PurePosixPath(nombre_arch).suffix.lower() not in IMG_EXTS:
            continue
        ii = (p.get("imageinfo") or [{}])[0]
        url = ii.get("thumburl") or ii.get("url")
        if not url:
            continue
        nfile = norm(pathlib.PurePosixPath(nombre_arch).stem)
        if nq not in nfile and nfile not in nq:
            continue
        dist = 0 if nfile == nq else (1 if nfile.startswith(nq) else 2)
        candidatos.append((dist, p.get("index", 9), url, titulo))
    if candidatos:
        candidatos.sort()
        _, _, url, titulo = candidatos[0]
        return url, titulo
    return None, None


def descargar(url, destino):
    # Fandom devuelve 403 sin cabecera Referer de su propio dominio
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": "https://arena-breakout-infinite.fandom.com/",
        "Accept": "image/*,*/*;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    destino.write_bytes(data)
    return len(data)


def main():
    armas = json.load(open(ROOT / "data" / "armas.json", encoding="utf-8"))
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    previo = json.load(open(MAPA, encoding="utf-8")) if MAPA.exists() else {}
    solo_faltantes = "--solo-faltantes" in sys.argv

    mapa = {}
    ok = 0
    sin = []
    for a in armas:
        nombre = a["arma"]
        rel = previo.get(nombre)
        if solo_faltantes and rel and (IMG_DIR / pathlib.Path(rel).name).exists():
            mapa[nombre] = rel
            ok += 1
            continue
        try:
            src, titulo = buscar_imagen(nombre)
        except Exception as e:
            sin.append((nombre, f"error de API: {e}"))
            continue
        if not src:
            sin.append((nombre, "sin imagen en la wiki"))
            continue
        ext = pathlib.PurePosixPath(urllib.parse.urlparse(src).path).suffix.lower() or ".png"
        fname = f"{slug(nombre)}{ext}"
        try:
            n = descargar(src, IMG_DIR / fname)
        except Exception as e:
            sin.append((nombre, f"error descargando: {e}"))
            continue
        mapa[nombre] = f"img/{fname}"
        ok += 1
        print(f"OK  {nombre:30s} ← {titulo}  ({max(n // 1024, 1)} KB)")
        time.sleep(0.12)

    MAPA.write_text(json.dumps(dict(sorted(mapa.items())), ensure_ascii=False, indent=1),
                    encoding="utf-8")
    # limpia imágenes huérfanas de ejecuciones anteriores
    referenciadas = {pathlib.Path(rel).name for rel in mapa.values()}
    for f in IMG_DIR.glob("*"):
        if f.is_file() and f.name not in referenciadas:
            f.unlink()
            print(f"borrada huérfana {f.name}")
    print(f"\n{ok} con imagen · {len(sin)} sin imagen")
    for nombre, motivo in sin:
        print(f"  PENDIENTE  {nombre:30s} {motivo}")
    print(f"Mapa → {MAPA.relative_to(ROOT)} ({len(mapa)} entradas)")


if __name__ == "__main__":
    main()
