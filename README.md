# ABI Build Codes — catálogo de builds de Arena Breakout: Infinite

Web estática (HTML/CSS/JS puro) con el catálogo completo del xlsx
`Catalogo_ABI_CORREGIDO_compatible.xlsx`: 424 configuraciones, 94 armas,
27 armas sin código, 105 códigos compartidos y las fuentes.

## Estructura

```
index.html        interfaz (pestañas: Builds, Índice, Sin build, Lista, Fuentes, Acerca de)
styles.css        estilos (tema oscuro, responsive)
app.js            buscador, filtros, orden, copiado de códigos
data/*.json       datos volcados desde el xlsx (aquí se engancha Supabase después)
scripts/extract.py extrae el xlsx → data/*.json
.github/workflows/deploy.yml  despliegue automático a GitHub Pages
```

## Regenerar los datos

```bash
python3 -m venv .venv && .venv/bin/pip install openpyxl
.venv/bin/python3 scripts/extract.py
```

El script valida que los encabezados del xlsx no cambien y falla si falta alguna columna.

## Ejecutar en local

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

## Subir a GitHub Pages

1. Crear el repositorio y hacer push:

```bash
git init
git add .
git commit -m "Catálogo ABI: web estática con builds de Arena Breakout Infinite"
git branch -M main
git remote add origin https://github.com/<usuario>/<repo>.git
git push -u origin main
```

2. En GitHub: **Settings → Pages → Source → GitHub Actions**.
3. Cada push a `main` despliega solo (workflow `deploy.yml`). La URL quedará en
   `https://<usuario>.github.io/<repo>/`.

Las rutas de `app.js`/`index.html` son relativas (`./data/...`), así que funciona
también en un repo con nombre de proyecto o en un dominio propio.

## Paso pendiente: Supabase

`data/*.json` ya sale con esquema plano y `id` por tabla, pensado para volcarse
tal cual a Supabase (tablas `builds`, `armas`, `sin_build`, `lista`, `fuentes`,
`leeme`). Pendiente: crear el proyecto, el SQL de tablas y un script de import
(`scripts/import_supabase.py` con `supabase-py` o `pg` COPY desde JSON).
