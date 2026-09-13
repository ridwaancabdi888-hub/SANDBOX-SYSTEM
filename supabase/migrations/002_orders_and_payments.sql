-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 002: Orders, order items, status history, payments, inventory transactions

create sequence order_number_seq start 1001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null unique default nextval('order_number_seq'),
  location_id uuid references locations(id) on delete set null,
  status order_status not null default 'NEW',
  source order_source not null,
  customer_note text,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  created_by uuid references profiles(id) on delete set null,
  access_token uuid not null default gen_random_uuid(),
  stock_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_status on orders(status);
create index idx_orders_created_at on orders(created_at desc);
create index idx_orders_location on orders(location_id);
create index idx_orders_access_token on orders(access_token);
create index idx_orders_source on orders(source);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  subtotal numeric(10,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create index idx_order_items_order on order_items(order_id);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  changed_by uuid references profiles(id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);

create index idx_order_status_history_order on order_status_history(order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method payment_method not null,
  amount numeric(10,2) not null,
  amount_paid numeric(10,2) not null,
  change_amount numeric(10,2) not null default 0,
  cashier_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_payments_order on payments(order_id);
create index idx_payments_created_at on payments(created_at desc);

create table inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  type stock_txn_type not null,
  quantity numeric(12,3) not null,
  before_quantity numeric(12,3) not null,
  after_quantity numeric(12,3) not null,
  user_id uuid references profiles(id) on delete set null,
  reason text,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_inventory_txn_ingredient on inventory_transactions(ingredient_id);
create index idx_inventory_txn_created_at on inventory_transactions(created_at desc);
