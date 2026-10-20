# ABI Build Codes — catálogo de builds de Arena Breakout: Infinite

Web estática (HTML/CSS/JS puro) con el catálogo completo del xlsx
`Catalogo_ABI_CORREGIDO_compatible.xlsx`: 424 configuraciones, 94 armas,
27 armas sin código, 105 códigos compartidos y las fuentes.

## Estructura

```
index.html        interfaz (pestañas: Builds, Índice, Sin build, Lista, Fuentes, Acerca de)
styles.css        estilos (tema oscuro, responsive)
app.js            buscador, filtros, orden, copiado de códigos, panel de verificación
data/*.json       datos volcados desde el xlsx + monitor.json (aquí se engancha Supabase)
scripts/extract.py extrae el xlsx → data/*.json
scripts/monitor.py comprueba fuentes, revalida códigos y detecta candidatos nuevos
discord_bot/       bot de Discord (/arma con autocompletado y menú por clase); ver su README
.github/workflows/update-data.yml  job diario que ejecuta monitor.py y publica
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

Si en el futuro se quiere añadir otro workflow de Actions, el token de `gh`
necesita scope `workflow` (`gh auth refresh -h github.com -s workflow`).

Las rutas de `app.js`/`index.html` son relativas (`./data/...`), así que funciona
también en un repo con nombre de proyecto o en un dominio propio.

## Monitor diario de fuentes

`scripts/monitor.py` (solo librería estándar) corre cada día a las 06:00 UTC en
GitHub Actions (`update-data.yml`) y hace tres cosas:

1. **Health check** de las 35 URLs únicas del catálogo (builds, índice de armas, fuentes).
2. **Revalida los 424 códigos**: comprueba si el código sigue publicado en su fuente
   (`presente` / `ausente` / `sin verificar`). Resultado en `data/monitor.json`,
   visible en la pestaña *Fuentes* y como badge en cada build.
3. **Busca códigos nuevos** en las guías (abibuilder, Steam, RSS de Reddit):
   candidatos con formato válido que no están en el catálogo → aviso en la web,
   sin autoinsertarlos.

Detalles prácticos:

- Reddit solo responde por `.rss` (el `.json` da 403) y se limita a 1 petición/10 s.
- `arenabreakout-infinite.com/weapons/` usa un checkpoint de Vercel que alterna
  200/429: se registra como *bloqueada* cuando pasa, sin romper el job.
- El job siempre commitea `data/monitor.json` (con la fecha de la comprobación);
  el push a `main` reconstruye Pages solo.

Ejecutar en local:

```bash
python3 scripts/monitor.py
```

Si configuras el secret `DISCORD_WEBHOOK` en el repo, el job avisa en Discord
cada vez que hay cambios (códigos caídos, candidatos nuevos).

## Bot de Discord

`discord_bot/` contiene un bot (discord.py) con `/arma` (autocompletado de las
94 armas) y `/catalogo` (menú por clase → arma) que responde con embeds
completos: etiqueta, nivel, precio, código y estado de verificación.
Se despliega en tu propio servidor con Docker; instrucciones en
[discord_bot/README.md](discord_bot/README.md).

## Paso pendiente: Supabase

`data/*.json` ya sale con esquema plano y `id` por tabla, pensado para volcarse
tal cual a Supabase (tablas `builds`, `armas`, `sin_build`, `lista`, `fuentes`,
`leeme`). Pendiente: crear el proyecto, el SQL de tablas y un script de import
(`scripts/import_supabase.py` con `supabase-py` o `pg` COPY desde JSON).
