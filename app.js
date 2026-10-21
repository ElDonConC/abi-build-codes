(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const nf = new Intl.NumberFormat("es-ES");
  const NIVEL_ORDER = { "Barata": 0, "Barata (sin precio)": 1, "Media": 2, "Premium": 3, "Sin precio": 4 };

  const state = {
    tab: "builds",
    data: {},
    monitor: null,
    f: {
      q: "", clase: "", nivel: "", orden: "arma",
      qArmas: "", claseArmas: "", ratingArmas: "",
      qLista: "", claseLista: "",
      qFav: "", ordenFav: "arma",
      qTop: "", claseTop: "", ordenTop: "top",
    },
  };

  /* ---------- favoritos (localStorage) ---------- */

  const FAV_KEY = "abi_favoritos_v1";
  let favs = new Set();
  try {
    favs = new Set((JSON.parse(localStorage.getItem(FAV_KEY)) || []).map(Number));
  } catch { /* sin localStorage o dato corrupto: empezamos vacío */ }

  const saveFavs = () => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch { /* modo privado */ }
  };

  function updateFavBadge() {
    const el = $("#fav-badge");
    if (!el) return;
    el.hidden = favs.size === 0;
    el.textContent = String(favs.size);
  }

  /* ---------- valoración de armas (localStorage) ---------- */

  const RATE_KEY = "abi_rating_armas_v1";
  let ratings = {};
  try {
    ratings = JSON.parse(localStorage.getItem(RATE_KEY)) || {};
  } catch { /* empezamos sin valoraciones */ }

  const saveRatings = () => {
    try { localStorage.setItem(RATE_KEY, JSON.stringify(ratings)); } catch { /* modo privado */ }
  };

  const ratingDe = (arma) => Number(ratings[arma]) || 0;

  function rateWidget(arma) {
    const v = ratingDe(arma);
    return `<span class="rate" data-arma="${esc(arma)}" role="group" aria-label="Valorar ${esc(arma)}"
      title="${v ? `Tu valoración: ${v}/5` : "Sin valorar: pulsa una estrella"}">` +
      [1, 2, 3, 4, 5].map((n) =>
        `<button type="button" class="rate-star${n <= v ? " on" : ""}" data-v="${n}" aria-label="${n} de 5">★</button>`).join("") +
      `</span>`;
  }


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

  const VERIF = {
    presente: ["badge-ok", "verificado en su fuente"],
    ausente: ["badge-ausente", "hoy no aparece en su fuente"],
    fuente_bloqueada: ["badge-noverif", "fuente bloqueada"],
    fuente_error: ["badge-noverif", "fuente caída"],
  };

  function verifBadge(buildId) {
    const st = state.verif && state.verif[buildId];
    if (!st || !VERIF[st.resultado]) return "";
    const [cls, label] = VERIF[st.resultado];
    const fecha = (st.checked_at || "").slice(0, 10);
    return `<span class="badge ${cls}" title="Última comprobación: ${esc(fecha)}">${esc(label)}</span>`;
  }

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

  /* ---------- Supabase (reportes) ---------- */

  const MOTIVOS = {
    no_funciona: "No funciona",
    arma_incorrecta: "Arma incorrecta",
    precio_desactualizado: "Precio desactualizado",
    otro: "Otro motivo",
  };
  const ESTADOS = {
    nuevo: "Nuevo",
    en_revision: "En revisión",
    resuelto: "Resuelto",
    rechazado: "Rechazado",
  };

  function sbConfig() {
    const cfg = window.ABI_CONFIG || {};
    const url = String(cfg.supabaseUrl || "").replace(/\/+$/, "");
    if (!url || url.startsWith("PENDING") || !cfg.supabaseKey) return null;
    return { url, key: String(cfg.supabaseKey) };
  }

  async function sbReq(path, { method = "GET", body, token } = {}) {
    const cfg = sbConfig();
    if (!cfg) throw new Error("supabase_sin_configurar");
    const res = await fetch(cfg.url + path, {
      method,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${token || cfg.key}`,
        "Content-Type": "application/json",
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    if (res.status === 204) return null;
    const txt = await res.text();
    try { return txt ? JSON.parse(txt) : null; } catch { return txt; }
  }

  /* ---------- diálogo de reporte ---------- */

  let reportBuild = null;

  function openReport(build) {
    reportBuild = build;
    $("#report-target").textContent = `${build.arma}${build.etiqueta ? " · " + build.etiqueta : ""} · ${build.codigo}`;
    $("#report-err").hidden = true;
    $("#report-form").reset();
    const dlg = $("#report-dialog");
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.open = true;
  }

  function closeReport() {
    const dlg = $("#report-dialog");
    if (typeof dlg.close === "function") dlg.close();
    else dlg.open = false;
    reportBuild = null;
  }

  async function submitReport() {
    const errEl = $("#report-err");
    errEl.hidden = true;
    if (!reportBuild) return;
    const fd = new FormData($("#report-form"));
    if (String(fd.get("empresa") || "").trim()) { closeReport(); toast("Reporte enviado, ¡gracias!"); return; }
    const payload = {
      build_id: reportBuild.id,
      arma: reportBuild.arma,
      codigo: reportBuild.codigo,
      motivo: String(fd.get("motivo") || "otro"),
      comentario: String(fd.get("comentario") || "").trim() || null,
      contacto: String(fd.get("contacto") || "").trim() || null,
    };
    const btn = $("#report-send");
    btn.disabled = true;
    try {
      await sbReq("/rest/v1/reportes", { method: "POST", body: payload });
      closeReport();
      toast("Reporte enviado, ¡gracias!");
    } catch (err) {
      errEl.hidden = false;
      errEl.textContent = String(err.message).includes("supabase_sin_configurar")
        ? "Los reportes aún no están disponibles."
        : "No se pudo enviar el reporte. Inténtalo más tarde.";
    } finally {
      btn.disabled = false;
    }
  }


  /* ---------- renders ---------- */

  function filteredBuilds(f, base) {
    const nq = norm(f.q);
    return base.filter((b) => {
      if (f.clase && b.clase !== f.clase) return false;
      if (f.nivel && b.nivel !== f.nivel) return false;
      if (!nq) return true;
      return norm([b.arma, b.clase, b.nivel, b.etiqueta, b.codigo, b.codigo_original, b.fuente, b.fecha, b.notas]
        .join(" ")).includes(nq);
    });
  }

  function sortBuilds(rows, orden) {
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
    return rows;
  }

  function renderBuilds() {
    const rows = sortBuilds(filteredBuilds(state.f, state.data.builds), state.f.orden);
    $("#count-builds").textContent = `${rows.length} de ${state.data.builds.length} configuraciones`;
    $("#list-builds").innerHTML = rows.length ? rows.map(buildCard).join("") : empty("Ninguna build coincide con la búsqueda.");
  }

  function renderFavoritos() {
    const base = state.data.builds.filter((b) => favs.has(b.id));
    const f = { q: state.f.qFav, clase: "", nivel: "", orden: state.f.ordenFav };
    const rows = sortBuilds(filteredBuilds(f, base), f.orden);
    $("#count-fav").textContent = `${rows.length} de ${favs.size} favoritos`;
    $("#list-fav").innerHTML = rows.length
      ? rows.map(buildCard).join("")
      : empty(favs.size
          ? "Ningún favorito coincide con la búsqueda."
          : "Aún no tienes favoritos: pulsa el corazón ♥ en cualquier build de la pestaña Builds.");
  }

  function buildCard(b) {
    const precio = b.precio_ref ?? b.precio_min;
    const rango = b.precio_min != null && b.precio_max != null && b.precio_min !== b.precio_max
      ? `${money(b.precio_min)} – ${money(b.precio_max)}` : null;
    return `
    <article class="card">
      <div class="card-top">
        <button class="btn-fav${favs.has(b.id) ? " is-on" : ""}" type="button" data-fav="${b.id}"
          aria-pressed="${favs.has(b.id)}" title="Guardar en favoritos" aria-label="Guardar en favoritos">${favs.has(b.id) ? "♥" : "♡"}</button>
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
          <div class="verif-line">${verifBadge(b.id)}</div>
          <div class="card-actions">
            <button class="btn-report" type="button" data-report="${b.id}" title="El código no funciona o algo no cuadra">Reportar</button>
          </div>
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

  function weaponCard(a, pos = null) {
    return `
      <article class="card">
        <div class="card-top">
          ${pos ? `<span class="pos" title="Puesto en el ranking">#${pos}</span>` : ""}
          <h3 class="card-title">${esc(a.arma)}</h3>
          <div class="card-meta">
            <span class="badge badge-clase">${esc(a.clase)}</span>
            ${a.hay_barata === "Sí" ? '<span class="badge badge-barata">Barata</span>' : ""}
            ${a.hay_media === "Sí" ? '<span class="badge badge-media">Media</span>' : ""}
            ${a.hay_premium === "Sí" ? '<span class="badge badge-premium">Premium</span>' : ""}
            ${rateWidget(a.arma)}
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
      </article>`;
  }

  function filterArmas(base, q, clase, ratingMin) {
    const nq = norm(q);
    return base.filter((a) => {
      if (clase && a.clase !== clase) return false;
      if (ratingMin === "rated" && !ratingDe(a.arma)) return false;
      if (ratingMin === "4" && ratingDe(a.arma) < 4) return false;
      if (ratingMin === "5" && ratingDe(a.arma) < 5) return false;
      if (!nq) return true;
      return norm([a.arma, a.clase, a.estado, a.cobertura, a.fuente_roster, a.notas].join(" ")).includes(nq);
    });
  }

  function renderArmas() {
    const rows = filterArmas(state.data.armas, state.f.qArmas, state.f.claseArmas, state.f.ratingArmas)
      .sort((a, b) => a.arma.localeCompare(b.arma, "es"));
    const nRated = state.data.armas.filter((a) => ratingDe(a.arma)).length;
    $("#count-armas").textContent =
      `${rows.length} de ${state.data.armas.length} armas en el índice${nRated ? ` · ${nRated} valorad${nRated === 1 ? "a" : "as"} por ti` : ""}`;
    $("#list-armas").innerHTML = rows.length ? rows.map((a) => weaponCard(a)).join("") : empty("Ningún arma coincide con la búsqueda.");
  }

  function renderTop() {
    const rows = filterArmas(state.data.armas, state.f.qTop, state.f.claseTop, "");
    const orden = state.f.ordenTop;
    rows.sort((a, b) => {
      if (orden === "arma") return a.arma.localeCompare(b.arma, "es");
      if (orden === "builds") {
        const d = (b.n_builds ?? 0) - (a.n_builds ?? 0);
        return d || a.arma.localeCompare(b.arma, "es");
      }
      const ra = ratingDe(a.arma), rb = ratingDe(b.arma);
      if (ra !== rb) return rb - ra;
      const d = (b.n_builds ?? 0) - (a.n_builds ?? 0);
      return d || a.arma.localeCompare(b.arma, "es");
    });
    const nRated = rows.filter((a) => ratingDe(a.arma)).length;
    const conPos = orden === "top" || orden === "builds";
    $("#count-top").textContent = nRated
      ? `${rows.length} armas · ${nRated} valorad${nRated === 1 ? "a" : "as"} por ti${orden === "top" ? " · tu ranking personal primero" : ""}`
      : `${rows.length} armas · aún no has valorado ninguna: pulsa estrellas ★ en cualquier arma`;
    $("#list-top").innerHTML = rows.length
      ? rows.map((a, i) => weaponCard(a, conPos ? i + 1 : null)).join("")
      : empty("Ningún arma coincide con la búsqueda.");
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

  function monitorCard() {
    const m = state.monitor;
    if (!m) return "";
    const r = m.resumen || {};
    const cands = m.candidatos || [];
    return `
    <div class="monitor">
      <h3>Estado de la comprobación automática</h3>
      <p class="when">Última comprobación: ${esc((m.updated_at || "").replace("T", " ").replace("+00:00", " UTC"))} · un job diario en GitHub Actions revisa las fuentes y revalida los códigos</p>
      <div class="chips">
        <span class="chip ok">Fuentes OK <b>${r.fuentes_ok ?? "—"}/${r.fuentes_total ?? "—"}</b></span>
        <span class="chip warn">Bloqueadas <b>${r.fuentes_bloqueadas ?? 0}</b></span>
        <span class="chip bad">Con error <b>${r.fuentes_error ?? 0}</b></span>
        <span class="chip ok">Códigos presentes <b>${r.codigos_presentes ?? 0}</b></span>
        <span class="chip warn">Hoy no aparecen <b>${r.codigos_ausentes ?? 0}</b></span>
        <span class="chip">Sin verificar <b>${r.codigos_no_comprobables ?? 0}</b></span>
      </div>
      ${cands.length ? `
      <details>
        <summary>${cands.length} códigos candidatos nuevos detectados en las guías (revisar)</summary>
        <div class="cand-grid">
          ${cands.map((c) => `<div class="cand"><code>${esc(c.codigo)}</code><a href="${esc(c.fuente)}" target="_blank" rel="noopener">${esc(c.fuente)}</a></div>`).join("")}
        </div>
        <p class="when">No se añaden automáticamente: revisa cada código en el cliente antes de incorporarlo al catálogo.</p>
      </details>` : ""}
    </div>`;
  }

  function renderFuentes() {
    $("#monitor-resumen").innerHTML = monitorCard();
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

  /* ---------- panel admin de reportes ---------- */

  const ADMIN_TOKEN = "abi_admin_token";
  const adminToken = () => { try { return sessionStorage.getItem(ADMIN_TOKEN); } catch { return null; } };
  const adminLogout = () => { try { sessionStorage.removeItem(ADMIN_TOKEN); } catch { /* noop */ } };

  async function adminLogin(email, password) {
    const cfg = sbConfig();
    if (!cfg) throw new Error("supabase_sin_configurar");
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const data = await res.json();
    if (!data.access_token) throw new Error("sin_token");
    try { sessionStorage.setItem(ADMIN_TOKEN, data.access_token); } catch { /* noop */ }
  }

  function repCard(r) {
    const fecha = String(r.created_at || "").replace("T", " ").slice(0, 16);
    return `
    <article class="card rep" data-rep="${r.id}">
      <div class="card-top">
        <h3 class="card-title">${esc(r.arma)}</h3>
        <div class="card-meta">
          <span class="badge badge-clase">${esc(MOTIVOS[r.motivo] || r.motivo)}</span>
          <span class="badge estado-${esc(r.estado)}">${esc(ESTADOS[r.estado] || r.estado)}</span>
          <span>${esc(fecha)} UTC</span>
        </div>
      </div>
      <p class="kv"><b>Código:</b> <code>${esc(r.codigo)}</code></p>
      ${r.comentario ? `<p class="kv"><b>Detalle:</b> ${esc(r.comentario)}</p>` : ""}
      ${r.contacto ? `<p class="kv"><b>Contacto:</b> ${esc(r.contacto)}</p>` : ""}
      <div class="rep-actions">
        <select data-estado="${r.id}" aria-label="Cambiar estado">
          ${Object.entries(ESTADOS).map(([v, l]) => `<option value="${v}"${v === r.estado ? " selected" : ""}>${l}</option>`).join("")}
        </select>
        <button class="btn-ghost" type="button" data-del="${r.id}">Borrar</button>
      </div>
    </article>`;
  }

  async function renderAdmin() {
    const root = $("#admin-root");
    if (!sbConfig()) {
      root.innerHTML = `<article class="card"><p class="kv">Los reportes aún no están conectados (falta configurar <code>config.js</code>).</p></article>`;
      return;
    }
    if (!adminToken()) {
      root.innerHTML = `
      <article class="card admin-login">
        <h3 class="src-title">Acceso de gestión</h3>
        <p class="kv">Entra con la cuenta de administradora de Supabase para ver los reportes de la comunidad.</p>
        <form id="admin-form">
          <label class="field-label" for="a-email">Email</label>
          <input type="email" id="a-email" required autocomplete="username">
          <label class="field-label" for="a-pass" style="margin-top:10px">Contraseña</label>
          <input type="password" id="a-pass" required autocomplete="current-password">
          <p class="report-err" id="admin-err" hidden></p>
          <div class="report-actions">
            <button type="submit" class="btn-primary">Entrar</button>
          </div>
        </form>
      </article>`;
      $("#admin-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = $("#admin-err");
        errEl.hidden = true;
        try {
          await adminLogin($("#a-email").value.trim(), $("#a-pass").value);
          renderAdmin();
        } catch (err) {
          errEl.hidden = false;
          errEl.textContent = String(err.message).includes("supabase_sin_configurar")
            ? "Los reportes aún no están disponibles."
            : "Email o contraseña incorrectos.";
        }
      });
      return;
    }
    root.innerHTML = `<article class="card"><p class="kv">Cargando reportes…</p></article>`;
    try {
      const rows = await sbReq("/rest/v1/reportes?select=*&order=created_at.desc", { token: adminToken() });
      const list = Array.isArray(rows) ? rows : [];
      const nuevos = list.filter((r) => r.estado === "nuevo").length;
      root.innerHTML = `
      <div class="admin-bar">
        <span class="count">${list.length} reportes${nuevos ? ` · ${nuevos} sin revisar` : ""}</span>
        <div class="admin-bar-actions">
          <button class="btn-ghost" type="button" id="admin-refresh">Refrescar</button>
          <button class="btn-ghost" type="button" id="admin-logout">Salir</button>
        </div>
      </div>
      <div class="list">${list.length ? list.map(repCard).join("") : empty("No hay reportes todavía.")}</div>`;
      $("#admin-refresh").addEventListener("click", renderAdmin);
      $("#admin-logout").addEventListener("click", () => { adminLogout(); renderAdmin(); });
    } catch (err) {
      adminLogout();
      root.innerHTML = `<article class="card"><p class="kv">No se pudo cargar${String(err.message).includes("http_401") ? " (sesión caducada)" : ""}. <button class="btn-ghost" type="button" id="admin-retry">Volver a entrar</button></p></article>`;
      $("#admin-retry").addEventListener("click", renderAdmin);
    }
  }

  const RENDER = {
    builds: renderBuilds,
    favoritos: renderFavoritos,
    top: renderTop,
    armas: renderArmas,
    sin_build: renderSin,
    lista: renderLista,
    fuentes: renderFuentes,
    leeme: renderLeeme,
    reportes: renderAdmin,
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
    on("#f-rating", "ratingArmas");
    on("#q-lista", "qLista");
    on("#f-clase-lista", "claseLista");
    on("#q-fav", "qFav");
    on("#f-orden-fav", "ordenFav");
    on("#q-top", "qTop");
    on("#f-clase-top", "claseTop");
    on("#f-orden-top", "ordenTop");

    $("#q-clear").addEventListener("click", () => {
      state.f.q = ""; state.f.clase = ""; state.f.nivel = ""; state.f.orden = "arma";
      $("#q").value = ""; $("#f-clase").value = ""; $("#f-nivel").value = ""; $("#f-orden").value = "arma";
      renderBuilds();
    });

    $("#q-clear-fav").addEventListener("click", () => {
      state.f.qFav = ""; state.f.ordenFav = "arma";
      $("#q-fav").value = ""; $("#f-orden-fav").value = "arma";
      renderFavoritos();
    });

    document.addEventListener("click", async (e) => {
      const copyBtn = e.target.closest(".btn-copy");
      if (copyBtn) {
        const ok = await copyText(copyBtn.dataset.copy);
        if (ok) {
          copyBtn.classList.add("copied");
          copyBtn.textContent = "Copiado";
          toast("Código copiado al portapapeles");
          setTimeout(() => { copyBtn.classList.remove("copied"); copyBtn.textContent = "Copiar"; }, 1400);
        } else {
          toast("No se pudo copiar");
        }
        return;
      }

      const favBtn = e.target.closest(".btn-fav");
      if (favBtn) {
        const id = Number(favBtn.dataset.fav);
        if (favs.has(id)) { favs.delete(id); toast("Quitado de favoritos"); }
        else { favs.add(id); toast("Añadido a favoritos ♥"); }
        saveFavs();
        updateFavBadge();
        document.querySelectorAll(`.btn-fav[data-fav="${id}"]`).forEach((btn) => {
          const on = favs.has(id);
          btn.classList.toggle("is-on", on);
          btn.textContent = on ? "♥" : "♡";
          btn.setAttribute("aria-pressed", String(on));
        });
        if (state.tab === "favoritos") renderFavoritos();
        return;
      }

      const rateStar = e.target.closest(".rate-star");
      if (rateStar) {
        const wrap = rateStar.closest(".rate");
        const arma = wrap.dataset.arma;
        const v = Number(rateStar.dataset.v);
        if (ratingDe(arma) === v) { delete ratings[arma]; toast("Valoración quitada"); }
        else { ratings[arma] = v; toast(`${arma}: ${"★".repeat(v)} ${v}/5`); }
        saveRatings();
        const cur = ratingDe(arma);
        document.querySelectorAll(`.rate[data-arma="${arma}"]`).forEach((w) => {
          w.title = cur ? `Tu valoración: ${cur}/5` : "Sin valorar: pulsa una estrella";
          w.querySelectorAll(".rate-star").forEach((s) => s.classList.toggle("on", Number(s.dataset.v) <= cur));
        });
        if (state.tab === "top") renderTop();
        else if (state.tab === "armas") renderArmas();
        return;
      }

      const repBtn = e.target.closest(".btn-report");
      if (repBtn) {
        const b = state.data.builds.find((x) => x.id === Number(repBtn.dataset.report));
        if (b) openReport(b);
      }
    });

    $("#report-cancel").addEventListener("click", closeReport);
    $("#report-form").addEventListener("submit", (e) => {
      e.preventDefault();
      submitReport();
    });

    $("#admin-root").addEventListener("change", async (e) => {
      const sel = e.target.closest("select[data-estado]");
      if (!sel) return;
      try {
        await sbReq(`/rest/v1/reportes?id=eq.${sel.dataset.estado}`, {
          method: "PATCH", token: adminToken(), body: { estado: sel.value },
        });
        toast("Estado actualizado");
        renderAdmin();
      } catch { toast("No se pudo actualizar"); }
    });

    $("#admin-root").addEventListener("click", async (e) => {
      const del = e.target.closest("button[data-del]");
      if (!del) return;
      if (!confirm("¿Borrar este reporte?")) return;
      try {
        await sbReq(`/rest/v1/reportes?id=eq.${del.dataset.del}`, { method: "DELETE", token: adminToken() });
        toast("Reporte borrado");
        renderAdmin();
      } catch { toast("No se pudo borrar"); }
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

    state.monitor = await fetch("./data/monitor.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (state.monitor && Array.isArray(state.monitor.codigos)) {
      state.verif = {};
      for (const c of state.monitor.codigos) state.verif[c.build_id] = c;
      $("#stat-verif").textContent = `${state.monitor.resumen?.codigos_presentes ?? 0}/${state.data.builds.length}`;
    } else {
      $("#stat-verif").textContent = "—";
    }

    fillSelect($("#f-clase"), uniq(state.data.builds.map((b) => b.clase)), "Todas las clases");
    fillSelect($("#f-nivel"), uniq(state.data.builds.map((b) => b.nivel)), "Todos los niveles");
    fillSelect($("#f-clase-armas"), uniq(state.data.armas.map((a) => a.clase)), "Todas las clases");
    fillSelect($("#f-clase-lista"), uniq(state.data.lista.map((l) => l.clase)), "Todas las clases");
    fillSelect($("#f-clase-top"), uniq(state.data.armas.map((a) => a.clase)), "Todas las clases");

    bindEvents();
    updateFavBadge();
    setTab(location.hash.replace("#", "") || "builds");
  }

  init();
})();
