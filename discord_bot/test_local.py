#!/usr/bin/env python3
"""Pruebas locales del catálogo sin conexión a Discord.

Uso: python3 test_local.py [ruta_a_data]
"""
import pathlib
import sys

from abi_data import (
    Catalogo, MAX_FIELD_NAME, MAX_FIELD_VALUE, MAX_FIELDS, norm,
)

DATA = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "../data")

fallos = []


def check(label, cond, extra="", quiet=False):
    if not cond or not quiet:
        print(f"{'PASS' if cond else 'FAIL'} {label}" + (f" — {extra}" if extra else ""))
    if not cond:
        fallos.append(label)


def check_embed_limits(label, p):
    total = len(p.get("title") or "") + len(p.get("description") or "")
    ok = len(p.get("title") or "") <= 256 and len(p.get("description") or "") <= 4096
    ok = ok and len(p.get("fields", [])) <= MAX_FIELDS
    for f in p.get("fields", []):
        total += len(f["name"]) + len(f["value"])
        ok = ok and len(f["name"]) <= MAX_FIELD_NAME and len(f["value"]) <= MAX_FIELD_VALUE
    footer = (p.get("footer") or {}).get("text", "")
    ok = ok and len(footer) <= 2048 and total + len(footer) <= 6000
    check(f"límites Discord: {label}", ok,
          f"fields={len(p.get('fields', []))} total={total + len(footer)}", quiet=True)


cat = Catalogo(bases=[str(DATA)])
cat.load()

check("builds cargados = 424", len(cat.builds) == 424, str(len(cat.builds)))
check("armas en índice = 94", len(cat.armas) == 94, str(len(cat.armas)))
check("clases listadas", len(cat.clases) >= 10, str(cat.clases[:4]))

# autocomplete
ac = cat.opciones_autocomplete("")
check("autocomplete vacío → 25", len(ac) == 25, str(len(ac)))
ac = cat.opciones_autocomplete("m4")
check("autocomplete 'm4' empieza por M4…", ac[0].startswith("M4"), ac[:3])
ac = cat.opciones_autocomplete("ak 1")
check("autocomplete tolera espacios", any("AK-1" in n for n in ac), ac[:3])
check("autocomplete insensible a acentos",
      cat.opciones_autocomplete("éagle")[0] == "Desert Eagle", cat.opciones_autocomplete("éagle")[:2])
check("buscar por nombre con guiones",
      cat.buscar("m4a1") and cat.buscar("ak 12") and cat.buscar("ak 12")["arma"] == "AK-12")

# embeds de TODAS las armas del índice
peores = 0
for a in cat.armas:
    p = cat.embed_arma(a["arma"])
    check_embed_limits(f"arma {a['arma']}", p)
    peores = max(peores, sum(len(f["name"]) + len(f["value"]) for f in p["fields"]))

p = cat.embed_arma("no-existe-xyz")
check("arma inexistente → título de aviso", "no encontrada" in p["title"].lower(), p["title"])
p = cat.embed_arma("m4a")
check("casi-existe sugiere alternativas", "M4A1" in p["description"] and len(p["fields"]) == 0, p["description"][:70])

# casos reales
p = cat.embed_arma("M4A1")
check("M4A1 con 21 builds → 21 fields", len(p["fields"]) == 21, str(len(p["fields"])))
check("fields con código en bloque", all("```" in f["value"] for f in p["fields"]))
check_embed_limits("arma M4A1", p)

sin_build = next(a["arma"] for a in cat.armas if not cat.builds_de(a["arma"]))
p = cat.embed_arma(sin_build)
check(f"arma sin builds ({sin_build}) → aviso", "sin códigos" in p["description"], p["description"][:60])
check_embed_limits(f"arma sin builds {sin_build}", p)

# clases y menús
for c in cat.clases:
    p = cat.embed_clase(c)
    check_embed_limits(f"clase {c}", p)
ops = cat.opciones_arma_de_clase("Rifle de asalto")
check("opciones de select ≤ 25", 0 < len(ops) <= 25, str(len(ops)))
check("opciones con descripción", all(o.get("description") for o in ops))
check("opciones de clases ≤ 25", len(cat.opciones_clase()) <= 25, str(len(cat.opciones_clase())))

p = cat.embed_catalogo()
check_embed_limits("catálogo", p)
check("catálogo muestra totales", "424" in p["description"], p["description"][:60])

# monitor presente (badge de verificación en algún field)
con_verif = sum(1 for f in cat.embed_arma("M4A1")["fields"] if "verificado" in f["value"] or "aparece" in f["value"])
check("verificación del monitor visible en M4A1", con_verif > 0, f"{con_verif} fields")

print()
print(f"{len(fallos)} fallos" if fallos else "TODO OK")
sys.exit(1 if fallos else 0)
