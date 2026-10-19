#!/usr/bin/env python3
"""Monitor diario de fuentes: comprueba URLs del catálogo, revalida códigos
de build contra su fuente y detecta códigos candidatos nuevos.

Solo usa la librería estándar. Escribe data/monitor.json (lo sirve la web).
Sale con código 1 si algo falla de forma inesperada.
"""
import datetime as dt
import gzip
import html as htmllib
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
TIMEOUT = 25
# Códigos reales del catálogo: 15 o 17 caracteres (3f + 13 o 15), siempre con mayúscula.
CODE_RE = re.compile(r"3f[A-Za-z0-9]{13}(?:[A-Za-z0-9]{2})?")
SECURITY_MARKERS = ("vercel security checkpoint", "just a moment", "captcha",
                    "attention required", "access denied")
# Segundos mínimos entre peticiones al mismo host (evita 429, p. ej. Reddit).
HOST_INTERVAL = {"reddit.com": 10, "abibuilder.com": 1.5, "steamcommunity.com": 2}
_last_hit = {}


def host_of(url):
    return url.split("/")[2].replace("www.", "")


def politeness(url):
    host = host_of(url)
    for key, wait in HOST_INTERVAL.items():
        if key in host:
            since = time.time() - _last_hit.get(host, 0)
            if since < wait:
                time.sleep(wait - since)
            _last_hit[host] = time.time()
            return
def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def fetch(url, tries=2):
    """Devuelve dict con status, texto y metadatos."""
    info = {"url": url, "status": None, "texto": "", "bytes": 0, "error": None}
    for attempt in range(tries):
        req = urllib.request.Request(url, headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        })
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                raw = resp.read()
                info["status"] = resp.status
                if resp.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                info["bytes"] = len(raw)
                info["texto"] = raw.decode("utf-8", errors="ignore")
                info["error"] = None
                return info
        except urllib.error.HTTPError as e:
            info["status"] = e.code
            info["error"] = f"HTTP {e.code}"
            if e.code in (429, 503) and attempt + 1 < tries:
                time.sleep(12 if "reddit.com" in url else 5)
                continue
            return info
        except Exception as e:  # timeout, DNS, TLS…
            info["error"] = type(e).__name__ + ": " + str(e)[:120]
            if attempt + 1 < tries:
                time.sleep(3)
                continue
            return info
    return info


def rss_url(url):
    if "reddit.com" in url and not url.rstrip("/").endswith(".rss"):
        return url.rstrip("/") + ".rss"
    return url


def feed_to_text_and_date(url):
    """Reddit: descarga el Atom feed del hilo, devuelve (texto plano, fecha)."""
    res = fetch(rss_url(url))
    if res["status"] != 200 or not res["texto"]:
        return res, "", None
    try:
        root = ET.fromstring(res["texto"])
    except ET.ParseError:
        return res, "", None
    ns = {"a": "http://www.w3.org/2005/Atom"}
    chunks, dates = [], []
    for entry in root.findall("a:entry", ns):
        updated = entry.findtext("a:updated", default="", namespaces=ns)
        if updated:
            dates.append(updated)
        for tag in ("content", "summary", "title"):
            node = entry.find(f"a:{tag}", ns)
            if node is not None and node.text:
                plain = re.sub(r"<[^>]+>", " ", htmllib.unescape(node.text))
                chunks.append(plain)
    return res, "\n".join(chunks), (max(dates) if dates else None)


def is_blocked(status, texto):
    low = texto[:20000].lower()
    if any(m in low for m in SECURITY_MARKERS):
        return True
    return status in (401, 403, 407, 429, 999)


def strip_prefix(code):
    for p in ("Mod Gun-", "Modificar arma-", "Modificar arma-", "Mod gun-"):
        if code.startswith(p):
            return code[len(p):]
    return code


def significant_part(monitor):
    """Estado sin marcas de tiempo: decide si hay cambios reales."""
    return {
        "fuentes": [{k: v for k, v in f.items() if k != "checked_at"} for f in monitor["fuentes"]],
        "codigos": [{k: v for k, v in c.items() if k != "checked_at"} for c in monitor["codigos"]],
        "candidatos": sorted({(c["codigo"], c["fuente"]) for c in monitor["candidatos"]}),
        "resumen": {k: v for k, v in monitor["resumen"].items()},
    }


def main():
    builds = json.loads((DATA / "builds.json").read_text(encoding="utf-8"))
    armas = json.loads((DATA / "armas.json").read_text(encoding="utf-8"))
    fuentes = json.loads((DATA / "fuentes.json").read_text(encoding="utf-8"))

    # --- 1. URLs a comprobar ---
    urls = {}  # url -> {"build_ids": [...], "refs": n}
    for b in builds:
        if b.get("url_fuente"):
            urls.setdefault(b["url_fuente"], {"build_ids": [], "refs": 0})["build_ids"].append(b["id"])
    for a in armas:
        if a.get("url_referencia"):
            urls.setdefault(a["url_referencia"], {"build_ids": [], "refs": 0})["refs"] += 1
    for f in fuentes:
        if f.get("url"):
            urls.setdefault(f["url"], {"build_ids": [], "refs": 0})["refs"] += 1

    print(f"{len(urls)} URLs únicas a comprobar")

    # --- 2. Fetch ---
    fetched = {}   # url -> info
    textos = {}    # url -> texto útil (no bloqueado)
    for i, url in enumerate(sorted(urls), start=1):
        politeness(url)
        if "reddit.com" in url:
            res, texto, _ = feed_to_text_and_date(url)
            res["texto"] = texto or res["texto"]
        else:
            res = fetch(url)
        fetched[url] = res
        bloqueada = is_blocked(res["status"], res["texto"])
        comprobable = res["status"] == 200 and not bloqueada and len(res["texto"]) > 500
        res["bloqueada"] = bloqueada
        res["comprobable"] = comprobable
        if comprobable:
            textos[url] = res["texto"]
        print(f"[{i}/{len(urls)}] {res['status']} {'BLOQUEADA' if bloqueada else ''} {url[:90]}")

    # --- 3. Revalidar códigos por build ---
    ts = now_iso()
    codigos = []
    for b in builds:
        codigo = b.get("codigo") or b.get("codigo_original")
        if not codigo:
            resultado = "sin_codigo"
        elif not b.get("url_fuente"):
            resultado = "sin_fuente"
        elif b["url_fuente"] not in textos:
            info = fetched.get(b["url_fuente"], {})
            if info.get("bloqueada"):
                resultado = "fuente_bloqueada"
            elif info.get("status") not in (None, 200):
                resultado = "fuente_error"
            else:
                resultado = "no_comprobable"
        else:
            texto = textos[b["url_fuente"]]
            variantes = {codigo, strip_prefix(codigo)}
            if b.get("codigo_original"):
                variantes.add(b["codigo_original"])
                variantes.add(strip_prefix(b["codigo_original"]))
            variantes = {v for v in variantes if v}
            resultado = "presente" if any(v in texto for v in variantes) else "ausente"
        codigos.append({"build_id": b["id"], "codigo": codigo,
                        "fuente": b.get("url_fuente"), "resultado": resultado,
                        "checked_at": ts})

    # --- 4. Candidatos: códigos en guías que no están en el catálogo ---
    catalogo = set()
    for b in builds:
        for v in (b.get("codigo"), b.get("codigo_original")):
            if v:
                catalogo.add(strip_prefix(v))
    candidatos = []
    vistos = set()
    for url, info in fetched.items():
        if info["status"] != 200 or url not in textos:
            continue
        host = url.split("/")[2]
        if not any(h in host for h in ("abibuilder.com", "steamcommunity.com", "reddit.com")):
            continue
        texto = textos[url]
        for m in CODE_RE.finditer(texto):
            cand = m.group(0)
            if cand in catalogo or cand in vistos:
                continue
            pre = texto[m.start() - 1:m.start()]
            post = texto[m.end():m.end() + 1]
            if pre in "/.-_=~%" or (post and (post.isalnum() or post in "/-")):
                continue  # parte de un hash/path más largo
            if not any(c.isupper() for c in cand) or not any(c.isdigit() for c in cand):
                continue  # los códigos reales mezclan mayúsculas y dígitos
            vistos.add(cand)
            candidatos.append({"codigo": cand, "fuente": url, "first_seen": ts})
            if len(candidatos) >= 50:
                break
        if len(candidatos) >= 50:
            break

    # --- 5. Resumen y salida ---
    resumen = {
        "fuentes_total": len(fetched),
        "fuentes_ok": sum(1 for r in fetched.values() if r["status"] == 200 and not r["bloqueada"]),
        "fuentes_bloqueadas": sum(1 for r in fetched.values() if r["bloqueada"]),
        "fuentes_error": sum(1 for r in fetched.values() if r["status"] not in (None, 200)),
        "codigos_presentes": sum(1 for c in codigos if c["resultado"] == "presente"),
        "codigos_ausentes": sum(1 for c in codigos if c["resultado"] == "ausente"),
        "codigos_no_comprobables": sum(1 for c in codigos
                                       if c["resultado"] not in ("presente", "ausente", "sin_codigo")),
        "candidatos_nuevos": len(candidatos),
    }

    monitor = {"updated_at": ts, "resumen": resumen, "fuentes": [], "codigos": codigos,
               "candidatos": candidatos}
    for url, r in sorted(fetched.items()):
        monitor["fuentes"].append({
            "url": url, "status": r["status"], "bloqueada": r["bloqueada"],
            "comprobable": r.get("comprobable", False), "bytes": r["bytes"],
            "error": r["error"], "builds_asociados": len(urls[url]["build_ids"]),
            "checked_at": ts,
        })

    prev_path = DATA / "monitor.json"
    prev = json.loads(prev_path.read_text(encoding="utf-8")) if prev_path.exists() else None
    changed = prev is None or significant_part(prev) != significant_part(monitor)
    monitor["hay_cambios"] = changed
    prev_path.write_text(json.dumps(monitor, ensure_ascii=False, indent=1), encoding="utf-8")

    print(json.dumps(resumen, ensure_ascii=False, indent=1))
    print("CAMBIOS SÍ" if changed else "CAMBIOS NO (solo timestamps)")
    gh_out = __import__("os").environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"changed={'true' if changed else 'false'}\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"FATAL: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
