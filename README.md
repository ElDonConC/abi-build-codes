# ABI Build Codes — catálogo de builds de Arena Breakout: Infinite

Web estática (HTML/CSS/JS puro) con el catálogo completo del xlsx
`Catalogo_ABI_CORREGIDO_compatible.xlsx`: 424 configuraciones, 94 armas,
27 armas sin código, 105 códigos compartidos y las fuentes.

## Estructura

```
index.html        interfaz (pestañas: Builds, ♥ Favoritos, Top armas, Índice, Sin build, Lista, Fuentes, Acerca de)
styles.css        estilos (tema oscuro, responsive)
app.js            buscador, filtros, orden, copiado, favoritos ♥, valoraciones ★, reportes y panel admin
config.js         credenciales públicas de Supabase (URL + publishable key) para los reportes
data/*.json       datos volcados desde el xlsx + monitor.json
scripts/extract.py extrae el xlsx → data/*.json
scripts/monitor.py comprueba fuentes, revalida códigos y detecta candidatos nuevos
docs/supabase.sql SQL para crear la tabla de reportes y sus políticas RLS
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

## Reportes de la comunidad y favoritos

### Favoritos y valoraciones (sin backend)

- El **corazón ♥** de cada build guarda esa configuración en el `localStorage`
  del navegador (clave `abi_favoritos_v1`); la pestaña **♥ Favoritos** las lista
  con búsqueda y orden, y su contador aparece en la propia pestaña.
- Las **estrellas ★** de cada arma están en **todas las pestañas** (Builds,
  Favoritos, Top, Índice, Sin build, Lista): valoran el arma de esa tarjeta
  1–5, sin login (clave `abi_rating_armas_v1`); vuelve a pulsar la misma
  estrella para quitarla. Puntúas en una pestaña y el resto se queda sincronizada.
- La pestaña **Top armas** ordena las 94 armas: primero tus valoradas (desc),
  después las que más builds tienen publicadas; cada tarjeta muestra su puesto
  (#1, #2…). En el Índice puedes filtrar por valoración (con la mía, ★4+, ★5).

Sin login, sin cuentas: cada jugador tiene lo suyo en su dispositivo.

### Reportes ("este código no funciona") → Supabase

Cada build tiene un botón **Reportar** que abre un formulario (motivo, detalle y
contacto opcionales) y lo inserta en la tabla `reportes` de Supabase por REST,
con la publishable key de `config.js`. La tabla está protegida con RLS:
cualquiera puede **insertar**, solo tu cuenta de admin puede **leer/editar/borrar**.

Configuración (una sola vez):

1. [supabase.com](https://supabase.com) → *New project* → copiar **Project URL**
   y **publishable key**.
2. SQL Editor → pegar y ejecutar [`docs/supabase.sql`](docs/supabase.sql).
3. Rellenar `config.js` con la URL y la clave (ya commiteado; la clave es
   pública por diseño: la barrera real es RLS).
4. *Authentication → Users → Invite user* con el email del admin (será quien
   entre en el panel de gestión).

Gestión: enlace **Gestión de reportes** en el pie del sitio (o la URL `#reportes`)
→ login con el email de admin → listado con badge *sin revisar*, cambio de estado
(`nuevo → en revisión → resuelto/rechazado`) y borrado. La sesión dura lo que
dure el token de Supabase; al caducar vuelve a pedir login.

Nota: el catálogo completo (`data/*.json`) **no** se copia a Supabase: vive en
GitHub y se sirve desde Pages; Supabase solo gestiona los reportes.
