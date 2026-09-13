-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 003: Notifications, activity logs, printer settings, expenses, settings

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  role app_role,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_target_check check (user_id is not null or role is not null)
);

create index idx_notifications_user on notifications(user_id, read);
create index idx_notifications_role on notifications(role, read);
create index idx_notifications_created_at on notifications(created_at desc);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  description text,
  created_at timestamptz not null default now()
);

create index idx_activity_logs_created_at on activity_logs(created_at desc);
create index idx_activity_logs_user on activity_logs(user_id);
create index idx_activity_logs_entity on activity_logs(entity_type, entity_id);

create table printer_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  width_mm int not null default 80 check (width_mm in (58, 80)),
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(10,2) not null check (amount >= 0),
  category text not null,
  description text,
  expense_date date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_expenses_date on expenses(expense_date desc);
create index idx_expenses_category on expenses(category);

create table settings (
  id int primary key default 1 check (id = 1),
  cafeteria_name text not null default 'SANDBOX',
  address text,
  phone text,
  currency text not null default 'USD',
  receipt_header text default 'SANDBOX CAFETERIA',
  receipt_footer text default 'THANK YOU!',
  low_stock_threshold_default numeric(12,3) not null default 5,
  allow_negative_stock boolean not null default false,
  order_settings jsonb not null default '{}'::jsonb,
  notification_settings jsonb not null default '{"waiter_ready_sound": true}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into settings (id) values (1);
