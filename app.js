(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const nf = new Intl.NumberFormat("es-ES");
  const NIVEL_ORDER = { "Barata": 0, "Barata (sin precio)": 1, "Media": 2, "Premium": 3, "Sin precio": 4 };

  const state = {
    tab: "builds",
    data: {},
    f: {
      q: "", clase: "", nivel: "", orden: "arma",
      qArmas: "", claseArmas: "",
      qLista: "", claseLista: "",
    },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const norm = (s) => String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const money = (n) => (n == null ? "—" : nf.format(n) + " Koen");

  const levelBadge = (nivel) => {
    const n = norm(nivel);
    if (!n) return '<span class="badge badge-sinprecio">Sin nivel</span>';
    if (n.startsWith("barata")) return `<span class="badge badge-barata">${esc(nivel)}</span>`;
    if (n.startsWith("media")) return `<span class="badge badge-media">${esc(nivel)}</span>`;
    if (n.startsWith("premium")) return `<span class="badge badge-premium">${esc(nivel)}</span>`;
    return `<span class="badge badge-sinprecio">${esc(nivel)}</span>`;
  };

  const codeBox = (code) => code
    ? `<div class="code"><code>${esc(code)}</code><button class="btn-copy" type="button" data-copy="${esc(code)}">Copiar</button></div>`
    : `<span class="field-value" style="color:var(--muted)">Sin código</span>`;

  const link = (url, label) =>
    url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label || url)}</a>` : "—";

  const empty = (msg) => `<p class="empty">${esc(msg)}</p>`;

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  }

  function fillSelect(sel, values, placeholder) {
    const current = sel.value;
    sel.innerHTML = `<option value="">${esc(placeholder)}</option>` +
      values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if (values.includes(current)) sel.value = current;
  }

  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

  /* ---------- renders ---------- */

  function renderBuilds() {
    const { q, clase, nivel, orden } = state.f;
    const nq = norm(q);
    let rows = state.data.builds.filter((b) => {
      if (clase && b.clase !== clase) return false;
      if (nivel && b.nivel !== nivel) return false;
      if (!nq) return true;
      return norm([b.arma, b.clase, b.nivel, b.etiqueta, b.codigo, b.codigo_original, b.fuente, b.fecha, b.notas]
        .join(" ")).includes(nq);
    });

    rows.sort((a, b) => {
      if (orden === "precio_asc" || orden === "precio_desc") {
        const pa = a.precio_ref ?? a.precio_min;
        const pb = b.precio_ref ?? b.precio_min;
        if (pa == null && pb == null) return a.arma.localeCompare(b.arma, "es");
        if (pa == null) return 1;
        if (pb == null) return -1;
        return orden === "precio_asc" ? pa - pb : pb - pa;
      }
      if (orden === "nivel") {
        const d = (NIVEL_ORDER[a.nivel] ?? 9) - (NIVEL_ORDER[b.nivel] ?? 9);
        if (d) return d;
      }
      return a.arma.localeCompare(b.arma, "es") || (a.etiqueta || "").localeCompare(b.etiqueta || "", "es");
    });

    $("#count-builds").textContent = `${rows.length} de ${state.data.builds.length} configuraciones`;
    $("#list-builds").innerHTML = rows.length ? rows.map(buildCard).join("") : empty("Ninguna build coincide con la búsqueda.");
  }

  function buildCard(b) {
    const precio = b.precio_ref ?? b.precio_min;
    const rango = b.precio_min != null && b.precio_max != null && b.precio_min !== b.precio_max
      ? `${money(b.precio_min)} – ${money(b.precio_max)}` : null;
    return `
    <article class="card">
      <div class="card-top">
        <h3 class="card-title">${esc(b.arma)}</h3>
        <div class="card-meta">
          <span class="badge badge-clase">${esc(b.clase)}</span>
          ${levelBadge(b.nivel)}
          ${b.etiqueta ? `<span>${esc(b.etiqueta)}</span>` : ""}
        </div>
      </div>
      <div class="card-grid">
        <div>
          <span class="field-label">Código para copiar</span>
          ${codeBox(b.codigo)}
          ${b.codigo_original && b.codigo_original !== b.codigo
            ? `<span class="field-label" style="margin-top:8px">Código original publicado</span><span class="field-value"><code>${esc(b.codigo_original)}</code></span>` : ""}
        </div>
        <div>
          <span class="field-label">Precio de referencia</span>
          <span class="price ${precio == null ? "none" : ""}">${precio == null ? "Sin precio publicado" : money(precio)}</span>
          ${rango ? `<span class="field-label" style="margin-top:8px">Rango publicado</span><span class="field-value">${rango}</span>` : ""}
        </div>
        <div>
          <span class="field-label">Fuente</span>
          <span class="field-value">${link(b.url_fuente, b.fuente || "Ver fuente")}</span>
          ${b.fecha ? `<span class="field-label" style="margin-top:8px">Fecha / temporada</span><span class="field-value">${esc(b.fecha)}</span>` : ""}
        </div>
      </div>
      ${(b.estado || b.notas || b.otras_fuentes) ? `
      <details class="extra">
        <summary>Verificación, notas y otras fuentes</summary>
        ${b.estado ? `<p class="field"><b>Estado:</b> ${esc(b.estado)}</p>` : ""}
        ${b.notas ? `<p class="field"><b>Notas:</b> ${esc(b.notas)}</p>` : ""}
        ${b.otras_fuentes ? `<p class="field"><b>Otras fuentes:</b> ${esc(b.otras_fuentes)}</p>` : ""}
      </details>` : ""}
    </article>`;
  }

  function renderArmas() {
    const nq = norm(state.f.qArmas);
    const clase = state.f.claseArmas;
    const rows = state.data.armas.filter((a) => {
      if (clase && a.clase !== clase) return false;
      if (!nq) return true;
      return norm([a.arma, a.clase, a.estado, a.cobertura, a.fuente_roster, a.notas].join(" ")).includes(nq);
    }).sort((a, b) => a.arma.localeCompare(b.arma, "es"));

    $("#count-armas").textContent = `${rows.length} de ${state.data.armas.length} armas en el índice`;
    $("#list-armas").innerHTML = rows.length ? rows.map((a) => `
      <article class="card">
        <div class="card-top">
          <h3 class="card-title">${esc(a.arma)}</h3>
          <div class="card-meta">
            <span class="badge badge-clase">${esc(a.clase)}</span>
            ${a.hay_barata === "Sí" ? '<span class="badge badge-barata">Barata</span>' : ""}
            ${a.hay_media === "Sí" ? '<span class="badge badge-media">Media</span>' : ""}
            ${a.hay_premium === "Sí" ? '<span class="badge badge-premium">Premium</span>' : ""}
          </div>
        </div>
        <div class="card-grid">
          <div>
            <span class="field-label">Builds / códigos únicos</span>
            <span class="field-value">${a.n_builds ?? "—"} · con precio: ${a.n_con_precio ?? "—"}</span>
            ${a.cobertura ? `<span class="field-label" style="margin-top:8px">Cobertura económica</span><span class="field-value">${esc(a.cobertura)}</span>` : ""}
          </div>
          <div>
            <span class="field-label">Código más barato</span>
            ${codeBox(a.codigo_mas_barato)}
            <span class="field-label" style="margin-top:8px">Precio mínimo</span>
            <span class="price ${a.precio_min == null ? "none" : ""}">${a.precio_min == null ? "Sin dato" : money(a.precio_min)}</span>
          </div>
          <div>
            <span class="field-label">Fuente del roster</span>
            <span class="field-value">${link(a.url_referencia, a.fuente_roster || "Ver fuente")}</span>
          </div>
        </div>
        ${(a.estado || a.notas) ? `
        <details class="extra">
          <summary>Estado y notas</summary>
          ${a.estado ? `<p class="field"><b>Estado:</b> ${esc(a.estado)}</p>` : ""}
          ${a.notas ? `<p class="field"><b>Notas:</b> ${esc(a.notas)}</p>` : ""}
        </details>` : ""}
      </article>`).join("") : empty("Ningún arma coincide con la búsqueda.");
  }

  function renderSin() {
    const rows = [...state.data.sin_build].sort((a, b) => a.arma.localeCompare(b.arma, "es"));
    $("#count-sin").textContent = `${rows.length} armas pendientes de código en las fuentes consultadas`;
    $("#list-sin").innerHTML = rows.map((a) => `
      <article class="card">
        <div class="card-top">
          <h3 class="card-title">${esc(a.arma)}</h3>
          <div class="card-meta"><span class="badge badge-clase">${esc(a.clase)}</span><span>${esc(a.resultado || "")}</span></div>
        </div>
        <div class="card-grid">
          <div>
            <span class="field-label">Fuente del roster</span>
            <span class="field-value">${link(a.url_referencia, a.fuente_roster || "Ver fuente")}</span>
          </div>
          <div>
            <span class="field-label">Estado</span>
            <span class="field-value">${esc(a.estado || "—")}</span>
          </div>
          <div>
            <span class="field-label">Notas</span>
            <span class="field-value">${esc(a.notas || "—")}</span>
          </div>
        </div>
      </article>`).join("");
  }

  function renderLista() {
    const nq = norm(state.f.qLista);
    const clase = state.f.claseLista;
    const rows = state.data.lista.filter((l) => {
      if (clase && l.clase !== clase) return false;
      if (!nq) return true;
      return norm([l.arma, l.clase, l.etiqueta, l.codigo, l.codigo_original, l.bloque, l.estado].join(" ")).includes(nq);
    }).sort((a, b) => a.arma.localeCompare(b.arma, "es"));

    $("#count-lista").textContent = `${rows.length} de ${state.data.lista.length} códigos compartidos`;
    $("#list-lista").innerHTML = rows.length ? rows.map((l) => `
      <article class="card">
        <div class="card-top">
          <h3 class="card-title">${esc(l.arma)}</h3>
          <div class="card-meta">
            <span class="badge badge-clase">${esc(l.clase)}</span>
            ${l.etiqueta ? `<span>${esc(l.etiqueta)}</span>` : ""}
            ${l.precio != null ? `<span class="price">${money(l.precio)}</span>` : levelBadge(l.nivel)}
          </div>
        </div>
        <div class="card-grid">
          <div>
            <span class="field-label">Código para copiar</span>
            ${codeBox(l.codigo)}
            ${l.codigo_original && l.codigo_original !== l.codigo
              ? `<span class="field-label" style="margin-top:8px">Código recibido</span><span class="field-value"><code>${esc(l.codigo_original)}</code></span>` : ""}
          </div>
          <div>
            <span class="field-label">Cruce con el catálogo</span>
            <span class="field-value">${esc(l.cruce || "—")}</span>
            ${l.fuente ? `<span class="field-label" style="margin-top:8px">Fuente coincidente</span><span class="field-value">${esc(l.fuente)}</span>` : ""}
          </div>
          <div>
            <span class="field-label">Bloque de origen</span>
            <span class="field-value">${esc(l.bloque || "—")}</span>
          </div>
        </div>
        ${(l.estado || l.notas) ? `
        <details class="extra">
          <summary>Verificación y notas</summary>
          ${l.estado ? `<p class="field"><b>Estado:</b> ${esc(l.estado)}</p>` : ""}
          ${l.notas ? `<p class="field"><b>Notas:</b> ${esc(l.notas)}</p>` : ""}
        </details>` : ""}
      </article>`).join("") : empty("Ningún código coincide con la búsqueda.");
  }

  function renderFuentes() {
    $("#list-fuentes").innerHTML = state.data.fuentes.map((f) => `
      <article class="card">
        <div class="src-head">
          <h3 class="src-title">${esc(f.nombre || "Fuente sin título")}</h3>
          ${f.tipo ? `<span class="badge badge-clase">${esc(f.tipo)}</span>` : ""}
          ${f.url ? `<span>${link(f.url, "Abrir enlace")}</span>` : ""}
        </div>
        ${f.fecha ? `<p class="kv"><b>Fecha / versión:</b> ${esc(f.fecha)}</p>` : ""}
        ${f.aporta ? `<p class="kv"><b>Aporta:</b> ${esc(f.aporta)}</p>` : ""}
        ${f.limitaciones ? `<p class="kv"><b>Limitaciones:</b> ${esc(f.limitaciones)}</p>` : ""}
      </article>`).join("");
  }

  function renderLeeme() {
    $("#list-leeme").innerHTML = state.data.leeme.map((l) => `
      <article class="card">
        <h3 class="src-title">${esc(l.tema)}</h3>
        <p class="kv">${esc(l.detalle)}</p>
      </article>`).join("") +
      `<article class="card">
        <h3 class="src-title">Cómo se usa este sitio</h3>
        <p class="kv">Busca tu arma en la pestaña <b>Builds</b>, filtra por clase y nivel económico, pulsa <b>Copiar</b> y pega el código en el Gunsmith del cliente (pegar código de modificación de arma).</p>
        <p class="kv">Los datos se sirven desde <code>data/*.json</code>, generados por <code>scripts/extract.py</code> desde el xlsx original.</p>
      </article>`;
  }

  const RENDER = {
    builds: renderBuilds,
    armas: renderArmas,
    sin_build: renderSin,
    lista: renderLista,
    fuentes: renderFuentes,
    leeme: renderLeeme,
  };

  function setTab(tab) {
    if (!RENDER[tab]) tab = "builds";
    state.tab = tab;
    document.querySelectorAll(".tab").forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".panel").forEach((p) => {
      const active = p.id === `panel-${tab}`;
      p.hidden = !active;
      p.classList.toggle("is-active", active);
    });
    if (history.replaceState) history.replaceState(null, "", `#${tab}`);
    RENDER[tab]();
  }

  function bindEvents() {
    $("#tabs").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if (btn) setTab(btn.dataset.tab);
    });

    const on = (sel, key) => {
      const el = $(sel);
      el.addEventListener("input", () => { state.f[key] = el.value; RENDER[state.tab](); });
    };
    on("#q", "q");
    on("#f-clase", "clase");
    on("#f-nivel", "nivel");
    on("#f-orden", "orden");
    on("#q-armas", "qArmas");
    on("#f-clase-armas", "claseArmas");
    on("#q-lista", "qLista");
    on("#f-clase-lista", "claseLista");

    $("#q-clear").addEventListener("click", () => {
      state.f.q = ""; state.f.clase = ""; state.f.nivel = ""; state.f.orden = "arma";
      $("#q").value = ""; $("#f-clase").value = ""; $("#f-nivel").value = ""; $("#f-orden").value = "arma";
      renderBuilds();
    });

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".btn-copy");
      if (!btn) return;
      const ok = await copyText(btn.dataset.copy);
      if (ok) {
        btn.classList.add("copied");
        btn.textContent = "Copiado";
        toast("Código copiado al portapapeles");
        setTimeout(() => { btn.classList.remove("copied"); btn.textContent = "Copiar"; }, 1400);
      } else {
        toast("No se pudo copiar");
      }
    });

    window.addEventListener("hashchange", () => setTab(location.hash.replace("#", "")));
  }

  async function init() {
    const names = ["builds", "armas", "sin_build", "lista", "fuentes", "leeme"];
    try {
      const results = await Promise.all(names.map((n) => fetch(`./data/${n}.json`).then((r) => {
        if (!r.ok) throw new Error(`${n}.json → HTTP ${r.status}`);
        return r.json();
      })));
      names.forEach((n, i) => { state.data[n] = results[i]; });
    } catch (err) {
      document.querySelector("main").innerHTML =
        `<p class="empty">No se pudieron cargar los datos (${esc(err.message)}). ¿Se sirve la web desde un servidor local?</p>`;
      return;
    }

    $("#stat-builds").textContent = nf.format(state.data.builds.length);
    $("#stat-armas").textContent = nf.format(state.data.armas.length);
    $("#stat-sin").textContent = nf.format(state.data.sin_build.length);

    fillSelect($("#f-clase"), uniq(state.data.builds.map((b) => b.clase)), "Todas las clases");
    fillSelect($("#f-nivel"), uniq(state.data.builds.map((b) => b.nivel)), "Todos los niveles");
    fillSelect($("#f-clase-armas"), uniq(state.data.armas.map((a) => a.clase)), "Todas las clases");
    fillSelect($("#f-clase-lista"), uniq(state.data.lista.map((l) => l.clase)), "Todas las clases");

    bindEvents();
    setTab(location.hash.replace("#", "") || "builds");
  }

  init();
})();
