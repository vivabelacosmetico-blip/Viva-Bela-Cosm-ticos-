create extension if not exists pgcrypto;
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null, description text default '',
 price numeric(10,2) not null check(price>0), image_url text default '', stock integer not null default 0 check(stock>=0),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), external_reference text unique not null,
 customer_name text not null, customer_email text not null, customer_phone text default '', shipping_address text default '',
 items jsonb not null, total_amount numeric(10,2) not null, status text not null default 'pending',
 mercadopago_order_id text, payment_data jsonb, created_at timestamptz not null default now()
);
-- A chave service_role fica somente no servidor. Nunca a coloque no HTML.
