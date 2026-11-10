-- Pega este script en Supabase → SQL Editor → Run
-- Crea la tabla de reportes y de estado de builds con sus políticas de seguridad (RLS).

create table if not exists public.reportes (
  id bigint generated always as identity primary key,
  build_id bigint not null,
  arma text not null,
  codigo text not null,
  motivo text not null check (motivo in ('no_funciona','arma_incorrecta','precio_desactualizado','otro')),
  comentario text,
  contacto text,
  estado text not null default 'nuevo' check (estado in ('nuevo','en_revision','resuelto','rechazado')),
  created_at timestamptz not null default now()
);

create index if not exists reportes_created_idx on public.reportes (created_at desc);

alter table public.reportes enable row level security;

-- Cualquiera (sin login) puede insertar un reporte.
drop policy if exists "cualquiera puede reportar" on public.reportes;
create policy "cualquiera puede reportar" on public.reportes
  for insert to anon, authenticated with check (true);

-- Solo usuarios autenticados (tu cuenta de admin) pueden leer.
drop policy if exists "solo admin lee" on public.reportes;
create policy "solo admin lee" on public.reportes
  for select to authenticated using (true);

-- Solo admin actualiza estados.
drop policy if exists "solo admin actualiza" on public.reportes;
create policy "solo admin actualiza" on public.reportes
  for update to authenticated using (true);

-- Solo admin borra.
drop policy if exists "solo admin borra" on public.reportes;
create policy "solo admin borra" on public.reportes
  for delete to authenticated using (true);

-- Tabla para moderación y estado de builds (ocultar / advertencia / código alternativo)
create table if not exists public.builds_moderacion (
  build_id bigint primary key,
  estado text not null default 'activa' check (estado in ('activa', 'advertencia', 'oculta')),
  motivo text,
  codigo_reemplazo text,
  actualizado_por text,
  updated_at timestamptz not null default now()
);

alter table public.builds_moderacion enable row level security;

-- Todos pueden leer el estado de moderación (público para que las tarjetas reflejen el estado)
drop policy if exists "lectura publica moderacion" on public.builds_moderacion;
create policy "lectura publica moderacion" on public.builds_moderacion
  for select to anon, authenticated using (true);

-- Solo admin puede insertar/modificar estados de builds
drop policy if exists "solo admin gestiona moderacion" on public.builds_moderacion;
create policy "solo admin gestiona moderacion" on public.builds_moderacion
  for all to authenticated using (true) with check (true);
