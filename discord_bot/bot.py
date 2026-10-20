#!/usr/bin/env python3
"""Bot de Discord del catálogo ABI.

Comandos:
  /arma <nombre>   → embed con todas las configuraciones del arma (con autocompletado)
  /catalogo        → menú por clase y menú por arma (persistente)

Variables de entorno (ver .env.example):
  DISCORD_TOKEN  token del bot (obligatorio)
  GUILD_ID       id de tu servidor para sincronizar al instante (opcional al probar)
"""
from __future__ import annotations

import logging
import os

import discord
from discord import app_commands
from discord.ext import tasks

from abi_data import Catalogo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("abi-bot")

TOKEN = os.environ.get("DISCORD_TOKEN", "").strip()
GUILD_ID = os.environ.get("GUILD_ID", "").strip()
CATALOGO = Catalogo()

bot = discord.Client(intents=discord.Intents.default())
tree = app_commands.CommandTree(bot)


def a_embed(payload: dict) -> discord.Embed:
    e = discord.Embed(
        title=payload.get("title"),
        description=payload.get("description"),
        color=payload.get("color", 0x4CC2FF),
        url=payload.get("url"),
    )
    for f in payload.get("fields", []):
        e.add_field(name=f["name"], value=f["value"], inline=f.get("inline", False))
    if payload.get("footer"):
        e.set_footer(text=payload["footer"].get("text"))
    return e


class CatalogoView(discord.ui.View):
    """Vista persistente con los dos menús. Sin estado propio: el valor del
    select de armas es el nombre, así que sobrevive a reinicios."""

    def __init__(self, clase: str | None = None):
        super().__init__(timeout=None)
        self.clase_select.options = [
            discord.SelectOption(label=c, value=c) for c in CATALOGO.opciones_clase()
        ]
        opciones = CATALOGO.opciones_arma_de_clase(clase) if clase else CATALOGO.opciones_arma_de_clase(CATALOGO.clases[0])
        self.arma_select.options = [
            discord.SelectOption(label=o["label"], value=o["value"], description=o.get("description"))
            for o in opciones
        ]

    @discord.ui.select(
        placeholder="Elige una clase…",
        custom_id="abi:clase",
        min_values=1, max_values=1,
        options=[discord.SelectOption(label="Cargando…", value="cargando")],
    )
    async def clase_select(self, interaction: discord.Interaction, select: discord.ui.Select):
        clase = select.values[0]
        await interaction.response.edit_message(
            embed=a_embed(CATALOGO.embed_clase(clase)),
            view=CatalogoView(clase),
        )

    @discord.ui.select(
        placeholder="Elige un arma…",
        custom_id="abi:arma",
        min_values=1, max_values=1,
        options=[discord.SelectOption(label="Cargando…", value="M4A1")],
    )
    async def arma_select(self, interaction: discord.Interaction, select: discord.ui.Select):
        await interaction.response.defer()
        payload = await bot.loop.run_in_executor(None, CATALOGO.embed_arma, select.values[0])
        await interaction.followup.send(embed=a_embed(payload), ephemeral=True)


@bot.event
async def on_ready():
    log.info("Conectado como %s", bot.user)
    if not refrescar.is_running():
        refrescar.start()


@tasks.loop(hours=6)
async def refrescar():
    try:
        await bot.loop.run_in_executor(None, lambda: CATALOGO.load(force=True))
        log.info("Catálogo recargado: %d builds, %d armas",
                 len(CATALOGO.builds), len(CATALOGO.armas))
    except Exception:
        log.exception("No se pudo refrescar; sigo con la copia en memoria")


@bot.event
async def setup_hook():
    await bot.loop.run_in_executor(None, CATALOGO.load)
    bot.add_view(CatalogoView())
    if GUILD_ID:
        guild = discord.Object(id=int(GUILD_ID))
        tree.copy_global_to(guild=guild)
        await tree.sync(guild=guild)
        log.info("Comandos sincronizados en el servidor %s", GUILD_ID)
    else:
        await tree.sync()
        log.info("Comandos sincronizados globalmente (puede tardar hasta 1h)")


async def autocomplete_arma(interaction: discord.Interaction, current: str):
    return [app_commands.Choice(name=n, value=n)
            for n in CATALOGO.opciones_autocomplete(current)]


@tree.command(name="arma", description="Códigos de build de un arma del catálogo ABI")
@app_commands.describe(nombre="Nombre del arma (autocompleta mientras escribes)")
@app_commands.autocomplete(nombre=autocomplete_arma)
async def cmd_arma(interaction: discord.Interaction, nombre: str):
    await interaction.response.defer()
    payload = await bot.loop.run_in_executor(None, CATALOGO.embed_arma, nombre)
    await interaction.followup.send(embed=a_embed(payload))


@tree.command(name="catalogo", description="Menú por clase para explorar las armas y sus códigos")
async def cmd_catalogo(interaction: discord.Interaction):
    await interaction.response.send_message(
        embed=a_embed(CATALOGO.embed_catalogo()), view=CatalogoView())


def main():
    if not TOKEN:
        raise SystemExit("Falta DISCORD_TOKEN (mira discord_bot/.env.example)")
    bot.run(TOKEN, log_handler=None)


if __name__ == "__main__":
    main()
