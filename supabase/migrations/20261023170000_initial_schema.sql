create table public.snapshots (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  created_at timestamptz not null default now(),
  descripcion text
);

create table public.administradores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.centros (
  snapshot_id uuid not null references public.snapshots (id) on delete cascade,
  centro_id text not null,
  nombre text not null check (btrim(nombre) <> ''),
  estado text not null check (btrim(estado) <> ''),
  zona text,
  coordinador_nombre text not null check (btrim(coordinador_nombre) <> ''),
  primary key (snapshot_id, centro_id)
);

create table public.productos (
  snapshot_id uuid not null references public.snapshots (id) on delete cascade,
  producto_id text not null,
  nombre text not null check (btrim(nombre) <> ''),
  unidad_base text not null check (unidad_base in ('ml', 'g', 'unidad')),
  primary key (snapshot_id, producto_id)
);

create table public.presentaciones (
  snapshot_id uuid not null,
  sku_id text not null,
  producto_id text not null,
  nombre text not null check (btrim(nombre) <> ''),
  contenido_por_paquete numeric(14, 3) not null check (contenido_por_paquete > 0),
  primary key (snapshot_id, sku_id),
  constraint presentaciones_producto_fk
    foreign key (snapshot_id, producto_id)
    references public.productos (snapshot_id, producto_id)
    on delete cascade
);

create table public.inventario_inicial (
  snapshot_id uuid not null,
  centro_id text not null,
  sku_id text not null,
  cantidad_paquetes integer not null check (cantidad_paquetes >= 0),
  primary key (snapshot_id, centro_id, sku_id),
  constraint inventario_centro_fk
    foreign key (snapshot_id, centro_id)
    references public.centros (snapshot_id, centro_id)
    on delete cascade,
  constraint inventario_presentacion_fk
    foreign key (snapshot_id, sku_id)
    references public.presentaciones (snapshot_id, sku_id)
    on delete cascade
);

create table public.necesidades (
  snapshot_id uuid not null,
  centro_id text not null,
  producto_id text not null,
  objetivo_unidad_base numeric(14, 3) not null check (objetivo_unidad_base >= 0),
  reserva_unidad_base numeric(14, 3) not null default 0 check (reserva_unidad_base >= 0),
  prioridad smallint not null check (prioridad between 1 and 3),
  primary key (snapshot_id, centro_id, producto_id),
  constraint necesidades_centro_fk
    foreign key (snapshot_id, centro_id)
    references public.centros (snapshot_id, centro_id)
    on delete cascade,
  constraint necesidades_producto_fk
    foreign key (snapshot_id, producto_id)
    references public.productos (snapshot_id, producto_id)
    on delete cascade
);

create table public.voluntarios (
  snapshot_id uuid not null,
  centro_id text not null,
  disponibles integer not null check (disponibles >= 0),
  requeridos integer not null check (requeridos >= 0),
  primary key (snapshot_id, centro_id),
  constraint voluntarios_centro_fk
    foreign key (snapshot_id, centro_id)
    references public.centros (snapshot_id, centro_id)
    on delete cascade
);

create table public.tiempos_traslado (
  snapshot_id uuid not null,
  origen_id text not null,
  destino_id text not null,
  minutos integer not null check (minutos >= 0),
  primary key (snapshot_id, origen_id, destino_id),
  constraint tiempos_origen_fk
    foreign key (snapshot_id, origen_id)
    references public.centros (snapshot_id, centro_id)
    on delete cascade,
  constraint tiempos_destino_fk
    foreign key (snapshot_id, destino_id)
    references public.centros (snapshot_id, centro_id)
    on delete cascade
);

create table public.donaciones_esperadas (
  snapshot_id uuid not null,
  intencion_id text not null,
  centro_id text not null,
  sku_id text not null,
  cantidad_paquetes integer not null check (cantidad_paquetes > 0),
  llegada_prevista timestamptz not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'recibida', 'cancelada')),
  primary key (snapshot_id, intencion_id),
  constraint donaciones_centro_fk
    foreign key (snapshot_id, centro_id)
    references public.centros (snapshot_id, centro_id)
    on delete cascade,
  constraint donaciones_presentacion_fk
    foreign key (snapshot_id, sku_id)
    references public.presentaciones (snapshot_id, sku_id)
    on delete cascade
);

create table public.simulaciones (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.snapshots (id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  hora_inicio timestamptz not null,
  hora_actual timestamptz not null,
  estado text not null check (estado in ('activa', 'finalizada')),
  check (hora_actual >= hora_inicio)
);

create table public.eventos_simulacion (
  id uuid primary key default gen_random_uuid(),
  simulacion_id uuid not null references public.simulaciones (id) on delete cascade,
  tipo text not null check (tipo in ('recepcion_confirmada', 'cambio_necesidad', 'cambio_voluntarios')),
  ocurrido_en timestamptz not null,
  registrado_en timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);

create index presentaciones_producto_idx
  on public.presentaciones (snapshot_id, producto_id);
create index inventario_presentacion_idx
  on public.inventario_inicial (snapshot_id, sku_id);
create index necesidades_producto_idx
  on public.necesidades (snapshot_id, producto_id);
create index tiempos_destino_idx
  on public.tiempos_traslado (snapshot_id, destino_id);
create index donaciones_centro_idx
  on public.donaciones_esperadas (snapshot_id, centro_id);
create index donaciones_presentacion_idx
  on public.donaciones_esperadas (snapshot_id, sku_id);
create index simulaciones_snapshot_idx
  on public.simulaciones (snapshot_id);
create index eventos_simulacion_idx
  on public.eventos_simulacion (simulacion_id, ocurrido_en);

alter table public.snapshots enable row level security;
alter table public.administradores enable row level security;
alter table public.centros enable row level security;
alter table public.productos enable row level security;
alter table public.presentaciones enable row level security;
alter table public.inventario_inicial enable row level security;
alter table public.necesidades enable row level security;
alter table public.voluntarios enable row level security;
alter table public.tiempos_traslado enable row level security;
alter table public.donaciones_esperadas enable row level security;
alter table public.simulaciones enable row level security;
alter table public.eventos_simulacion enable row level security;

revoke all on table public.snapshots from anon, authenticated;
revoke all on table public.administradores from anon, authenticated;
revoke all on table public.centros from anon, authenticated;
revoke all on table public.productos from anon, authenticated;
revoke all on table public.presentaciones from anon, authenticated;
revoke all on table public.inventario_inicial from anon, authenticated;
revoke all on table public.necesidades from anon, authenticated;
revoke all on table public.voluntarios from anon, authenticated;
revoke all on table public.tiempos_traslado from anon, authenticated;
revoke all on table public.donaciones_esperadas from anon, authenticated;
revoke all on table public.simulaciones from anon, authenticated;
revoke all on table public.eventos_simulacion from anon, authenticated;

grant select on table public.administradores to authenticated;
grant select on table public.snapshots to authenticated;
grant select on table public.centros to authenticated;
grant select on table public.productos to authenticated;
grant select on table public.presentaciones to authenticated;
grant select on table public.inventario_inicial to authenticated;
grant select on table public.necesidades to authenticated;
grant select on table public.voluntarios to authenticated;
grant select on table public.tiempos_traslado to authenticated;
grant select on table public.donaciones_esperadas to authenticated;
grant select on table public.simulaciones to authenticated;
grant select on table public.eventos_simulacion to authenticated;

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.administradores
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.es_administrador() from public;
grant execute on function public.es_administrador() to authenticated;

create policy administradores_lectura_propia
  on public.administradores
  for select
  to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy snapshots_lectura_admin
  on public.snapshots for select to authenticated
  using ((select public.es_administrador()));
create policy centros_lectura_admin
  on public.centros for select to authenticated
  using ((select public.es_administrador()));
create policy productos_lectura_admin
  on public.productos for select to authenticated
  using ((select public.es_administrador()));
create policy presentaciones_lectura_admin
  on public.presentaciones for select to authenticated
  using ((select public.es_administrador()));
create policy inventario_lectura_admin
  on public.inventario_inicial for select to authenticated
  using ((select public.es_administrador()));
create policy necesidades_lectura_admin
  on public.necesidades for select to authenticated
  using ((select public.es_administrador()));
create policy voluntarios_lectura_admin
  on public.voluntarios for select to authenticated
  using ((select public.es_administrador()));
create policy tiempos_lectura_admin
  on public.tiempos_traslado for select to authenticated
  using ((select public.es_administrador()));
create policy donaciones_lectura_admin
  on public.donaciones_esperadas for select to authenticated
  using ((select public.es_administrador()));
create policy simulaciones_lectura_admin
  on public.simulaciones for select to authenticated
  using ((select public.es_administrador()));
create policy eventos_lectura_admin
  on public.eventos_simulacion for select to authenticated
  using ((select public.es_administrador()));

