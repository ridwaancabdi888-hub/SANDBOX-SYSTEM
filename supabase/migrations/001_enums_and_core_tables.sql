-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 001: Enums + core reference tables (profiles, categories, products, ingredients, locations)

create extension if not exists "pgcrypto";

-- ==========================================================================
-- ENUMS
-- ==========================================================================
create type app_role as enum ('admin', 'cashier', 'kitchen', 'waiter');
create type order_status as enum ('NEW', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');
create type order_source as enum ('QR_CUSTOMER', 'WAITER', 'CASHIER', 'ADMIN');
create type payment_method as enum ('CASH', 'ZAAD', 'EDAHAB', 'OTHER');
create type ingredient_unit as enum ('kg', 'g', 'L', 'ml', 'pcs', 'box', 'pack');
create type stock_txn_type as enum ('PURCHASE', 'SALE', 'ADJUSTMENT', 'WASTE', 'RETURN');

-- ==========================================================================
-- PROFILES (extends auth.users)
-- ==========================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role app_role not null default 'cashier',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_profiles_role on profiles(role);

-- ==========================================================================
-- CATEGORIES
-- ==========================================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ==========================================================================
-- PRODUCTS
-- ==========================================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  description text,
  image_url text,
  price numeric(10,2) not null check (price >= 0),
  available boolean not null default true,
  sku text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_category on products(category_id);
create index idx_products_available on products(available);

-- ==========================================================================
-- INGREDIENTS (inventory)
-- ==========================================================================
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit ingredient_unit not null,
  current_quantity numeric(12,3) not null default 0,
  minimum_quantity numeric(12,3) not null default 0,
  cost numeric(10,2) default 0,
  supplier text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ingredients_active on ingredients(active);

-- ==========================================================================
-- PRODUCT_INGREDIENTS (recipes)
-- ==========================================================================
create table product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  unique (product_id, ingredient_id)
);

create index idx_product_ingredients_product on product_ingredients(product_id);

-- ==========================================================================
-- LOCATIONS (QR seating locations)
-- ==========================================================================
create table locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  qr_token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
