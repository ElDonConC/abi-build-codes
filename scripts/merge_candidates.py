#!/usr/bin/env python3
"""Sincroniza y fusiona candidatos de data/monitor.json y fuentes web
hacia data/builds.json, manteniendo la base de datos viva y actualizada.

Solo usa la librería estándar.
"""
import datetime as dt
import html as htmllib
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

CARD_RE = re.compile(
    r"<span>([0-9,]+)</span>.*?<h3[^>]*>([^<]+)</h3>.*?Build Code</div><div[^>]*>([^<]+)</div>",
    re.DOTALL
)


def normalize_code(raw: str) -> str:
    raw = (raw or "").strip()
    clean = raw.replace("Mod Gun-", "").replace("Modificar arma-", "").strip()
    return f"Mod Gun-{clean}" if clean else ""


def raw_code(raw: str) -> str:
    raw = (raw or "").strip()
    return raw.replace("Mod Gun-", "").replace("Modificar arma-", "").strip()


def determine_level(price: int) -> str:
    if not price:
        return "Económica"
    if price < 200000:
        return "Económica"
    if price <= 450000:
        return "Intermedia"
    return "Premium"


def match_weapon(raw_name: str, armas_list: list) -> tuple:
    raw_upper = raw_name.upper().replace("İ", "I")
    # Limpiezas típicas de títulos en ABI Builder
    raw_clean = re.sub(r"\b(META|BUİLD|BUILD|BURST|KIT|ONE TAP|FARM|BUDGET|RECOIL)\b", "", raw_upper).strip()

    # Mapeos conocidos
    alias = {
        "HK416": "H416",
        "HK 416": "H416",
        "M4": "M4A1",
        "MP5SD": "MP5",
    }
    for k, v in alias.items():
        if k in raw_clean:
            raw_clean = raw_clean.replace(k, v)

    # 1. Búsqueda exacta
    for a in armas_list:
        w_name = a["arma"]
        if w_name.upper() == raw_clean:
            return w_name, a.get("clase", "Arma")

    # 2. Contención por palabra completa
    for a in armas_list:
        w_name = a["arma"]
        pattern = r"\b" + re.escape(w_name.upper()) + r"\b"
        if re.search(pattern, raw_clean) or re.search(pattern, raw_upper):
            return w_name, a.get("clase", "Arma")

    # 3. Fallback a subcadena
    for a in armas_list:
        w_name = a["arma"]
        if w_name.upper() in raw_upper:
            return w_name, a.get("clase", "Arma")

    return raw_name.strip()[:20], "Arma"


def scrape_cards(url: str):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8", "ignore")
        cards = []
        for price_str, title_str, code_str in CARD_RE.findall(html):
            price = int(price_str.replace(",", "").strip())
            title = htmllib.unescape(title_str).strip()
            code = htmllib.unescape(code_str).strip()
            cards.append({"title": title, "price": price, "code": code})
        return cards
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return []


def main():
    builds_path = DATA / "builds.json"
    armas_path = DATA / "armas.json"
    monitor_path = DATA / "monitor.json"

    if not builds_path.exists() or not monitor_path.exists():
        print("Archivos de datos no encontrados.")
        return

    with open(builds_path, "r", encoding="utf-8") as f:
        builds = json.load(f)

    with open(armas_path, "r", encoding="utf-8") as f:
        armas = json.load(f)

    with open(monitor_path, "r", encoding="utf-8") as f:
        monitor = json.load(f)

    existing_codes = {raw_code(b.get("codigo_original") or b.get("codigo")) for b in builds}
    next_id = max((b.get("id", 0) for b in builds), default=0) + 1

    candidatos = monitor.get("candidatos", [])
    if not candidatos:
        print("No hay candidatos en monitor.json.")
        return

    # Cache de URLs ya scrapeadas
    url_cards = {}
    fuentes_candidatos = {c["fuente"] for c in candidatos if "abibuilder.com" in c.get("fuente", "")}

    for url in fuentes_candidatos:
        print(f"Consultando metadata desde: {url} ...")
        url_cards[url] = scrape_cards(url)

    nuevos_builds = []
    hoy_iso = dt.date.today().isoformat()

    for c in candidatos:
        c_code_raw = raw_code(c["codigo"])
        if c_code_raw in existing_codes:
            continue

        url = c.get("fuente", "")
        cards = url_cards.get(url, [])

        # Buscar si la card tiene este código
        matched_card = None
        for card in cards:
            if raw_code(card["code"]) == c_code_raw:
                matched_card = card
                break

        if matched_card:
            title = matched_card["title"]
            price = matched_card["price"]
            arma, clase = match_weapon(title, armas)
            etiqueta = title if title != arma else "Variante ABI Builder"
        else:
            # Si no vino de card o falló regex, deducir de query param ?weapons=
            m_param = re.search(r"weapons=([a-zA-Z0-9_-]+)", url)
            if m_param:
                arma, clase = match_weapon(m_param.group(1), armas)
                etiqueta = f"Comunitaria {arma}"
            else:
                arma, clase = "Arma comunitaria", "Rifle de asalto"
                etiqueta = "Código detectado por monitor"
            price = 0

        nivel = determine_level(price)
        norm_code = normalize_code(c_code_raw)

        nuevo = {
            "id": next_id,
            "arma": arma,
            "clase": clase,
            "nivel": nivel,
            "precio_ref": price,
            "precio_min": price,
            "precio_max": price,
            "etiqueta": etiqueta,
            "codigo": norm_code,
            "codigo_original": c_code_raw,
            "estado": "Código detectado y revalidado automáticamente",
            "fuente": "ABI Builder (Monitor diario)",
            "fecha": f"Agregado automáticamente · {hoy_iso}",
            "url_fuente": url,
            "otras_fuentes": None,
            "notas": f"Importado automáticamente por GitHub Actions desde {url}."
        }

        builds.append(nuevo)
        existing_codes.add(c_code_raw)
        nuevos_builds.append(nuevo)
        next_id += 1

    print(f"Builds nuevos a incorporar: {len(nuevos_builds)}")

    if nuevos_builds:
        # Actualizar n_builds en armas.json para mantener estadísticas sincronizadas
        counts = {}
        for b in builds:
            w = b.get("arma")
            counts[w] = counts.get(w, 0) + 1

        for a in armas:
            a["n_builds"] = counts.get(a["arma"], 0)

        with open(builds_path, "w", encoding="utf-8") as f:
            json.dump(builds, f, indent=2, ensure_ascii=False)

        with open(armas_path, "w", encoding="utf-8") as f:
            json.dump(armas, f, indent=2, ensure_ascii=False)

        print(f"Base de datos actualizada con {len(nuevos_builds)} nuevas builds. Total: {len(builds)}")
    else:
        print("No hay nuevas builds para agregar.")


if __name__ == "__main__":
    main()

