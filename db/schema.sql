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

create or replace function registrar_movimiento(
  p_producto_id uuid,
  p_tipo text,
  p_cantidad integer,
  p_nota text default null
)
returns movimientos_stock
language plpgsql
set search_path = public
as $$
declare
  v_stock integer;
  v_movimiento movimientos_stock;
begin
  if p_tipo not in ('entrada', 'salida') then
    raise exception 'TIPO_INVALIDO';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'CANTIDAD_INVALIDA';
  end if;

  select stock_actual into v_stock
  from productos
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'PRODUCTO_NO_ENCONTRADO';
  end if;

  if p_tipo = 'salida' and v_stock < p_cantidad then
    raise exception 'STOCK_INSUFICIENTE';
  end if;

  update productos
  set stock_actual = case
    when p_tipo = 'entrada' then stock_actual + p_cantidad
    else stock_actual - p_cantidad
  end
  where id = p_producto_id;

  insert into movimientos_stock (producto_id, tipo, cantidad, nota)
  values (p_producto_id, p_tipo, p_cantidad, p_nota)
  returning * into v_movimiento;

  return v_movimiento;
end;
$$;

revoke all on function registrar_movimiento(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function registrar_movimiento(uuid, text, integer, text) to service_role;
