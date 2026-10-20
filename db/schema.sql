create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria_id uuid references categorias(id),
  precio numeric(10,2) not null check (precio >= 0),
  stock_actual integer not null default 0 check (stock_actual >= 0),
  stock_minimo integer not null default 5,
  creado_en timestamptz not null default now()
);

create table movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  cantidad integer not null check (cantidad > 0),
  nota text,
  creado_en timestamptz not null default now()
);

grant select, insert, update, delete on all tables in schema public to service_role;

alter table categorias enable row level security;
alter table productos enable row level security;
alter table movimientos_stock enable row level security;
