# Bot de Discord del catálogo ABI

Bot con slash commands que consulta los códigos de build de Arena Breakout: Infinite.

## Qué hace

| Comando | Qué ves |
|---|---|
| `/arma <nombre>` | Autocompleta mientras escribes (94 armas, insensible a acentos y a `AK 12`/`AK-12`) y manda un embed con **todas** las configuraciones del arma: etiqueta, nivel, precio, código para copiar y estado de verificación |
| `/catalogo` | Menú por clase → menú por arma (las 25 con más builds) → embed de esa arma |

El bot descarga `data/*.json` desde GitHub al arrancar y los refresca cada 6 h, así que siempre va con el mismo catálogo y monitor que la web.

## Instalación en tu servidor

### 1. Crear la aplicación en Discord

1. https://discord.com/developers/applications → **New Application**.
2. Pestaña **Bot** → **Reset Token** → copia el token (va en `.env`, nunca al repo).
3. **No** necesitas activar Privileged Gateway Intents (solo usamos slash commands).
4. Pestaña **OAuth2 → URL Generator**: marca los scopes `bot` y `applications.commands`,
   y en Bot Permissions: *Send Messages*, *Embed Links*. Abre la URL generada y añade el bot a tu servidor.

### 2. Configurar el entorno

```bash
cd discord_bot
cp .env.example .env
# edita .env: DISCORD_TOKEN=... y GUILD_ID= id de tu servidor
# (Discord > ajustes del servidor > Ajustes avanzado > Modo desarrollador > copiar ID)
```

Con `GUILD_ID` los comandos aparecen al instante en ese servidor. Sin él, se registran
globalmente y Discord tarda hasta 1 h en propagarlos.

### 3. Arrancar

Con Docker (recomendado):

```bash
docker compose up -d --build
docker compose logs -f   # debe decir "Conectado como <bot>"
```

O a pelo con Python ≥3.10:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
DISCORD_TOKEN=... GUILD_ID=... .venv/bin/python bot.py
```

Reinicios automáticos: `restart: unless-stopped` en el compose. Si prefieres systemd,
haz un servicio que ejecute el mismo comando.

### 4. Probar

En cualquier canal del servidor: `/arma` → escribe `m4` → elige M4A1. Y `/catalogo` para el menú.

## Pruebas locales (sin Discord)

```bash
cd discord_bot
python3 test_local.py ../data
```

Comprueba los límites de la API de Discord en los 94 embeds, el autocomplete y los menús.

## Notificaciones del monitor diario

El job de GitHub Actions puede avisar en un canal cuando detecte cambios
(códigos que dejaron de aparecer, candidatos nuevos…):

1. En Discord: *Ajustes del canal → Integraciones → Webhooks de sitio → Nuevo webhook → Copiar URL de webhook*.
2. En GitHub: *Settings → Secrets and variables → Actions → New repository secret*,
   nombre `DISCORD_WEBHOOK`, valor la URL.
3. Cada corrida con cambios mandará un mensaje resumen. **Sin ese secret, el job funciona igual, sin avisar.**

Si prefieres gestionarlo en **n8n**: crea un workflow con cron diario que lea
`https://raw.githubusercontent.com/ElDonConC/abi-build-codes/main/data/monitor.json`
y publique por un nodo *Discord* o *Webhook* hacia tu servidor de n8n. El resultado es el mismo.

## Notas

- El token es la contraseña del bot: si se filtra, *Reset Token* en el portal.
- Si borras `data/` o GitHub cae, el bot sigue con la última copia en memoria
  (lo avisa en los logs si no puede refrescar).
- Los códigos los pega el jugador en el Gunsmith del cliente; el bot no entra al juego.
