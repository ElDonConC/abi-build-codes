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
.github/workflows/deploy.yml  despliegue con Actions (opcional, local; ver Publicación)
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

## Publicación

**En vivo: https://eldonconc.github.io/abi-build-codes/** (repositorio: `ElDonConC/abi-build-codes`)

GitHub Pages está configurado con *Settings → Pages → Source → Deploy from a branch*
(`main`, raíz). Cualquier `git push` a `main` vuelve a publicar:

```bash
git add -A
git commit -m "Actualización de datos"
git push
```

Si en el futuro se quiere el despliegue con Actions
(`.github/workflows/deploy.yml`, local), primero hay que re-autenticar el token
con scope `workflow`:

```bash
gh auth refresh -h github.com -s workflow
git add .github/workflows/deploy.yml   # quitar .github/workflows/ de .gitignore
```

Y en **Settings → Pages → Source** cambiar a *GitHub Actions*.

Las rutas de `app.js`/`index.html` son relativas (`./data/...`), así que funciona
también en un repo con nombre de proyecto o en un dominio propio.

## Paso pendiente: Supabase

`data/*.json` ya sale con esquema plano y `id` por tabla, pensado para volcarse
tal cual a Supabase (tablas `builds`, `armas`, `sin_build`, `lista`, `fuentes`,
`leeme`). Pendiente: crear el proyecto, el SQL de tablas y un script de import
(`scripts/import_supabase.py` con `supabase-py` o `pg` COPY desde JSON).
