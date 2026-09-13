-- SANDBOX CAFETERIA MANAGEMENT SYSTEM
-- Migration 007: Demo seed data (menu, ingredients, recipes, QR locations)
-- Safe to delete/edit later — this is development/demo data only.
-- Staff user accounts are NOT created here; run `npm run seed:users` once
-- SUPABASE_SERVICE_ROLE_KEY is configured in .env.local.

insert into categories (name, sort_order) values
  ('Food', 1),
  ('Coffee', 2),
  ('Juice', 3),
  ('Drinks', 4),
  ('Snacks', 5),
  ('Other', 6);

insert into ingredients (name, unit, current_quantity, minimum_quantity, cost, supplier) values
  ('Chicken', 'kg', 20, 5, 4.50, 'Local Butcher'),
  ('Rice', 'kg', 30, 8, 1.20, 'Grain Co'),
  ('Cooking Oil', 'L', 15, 4, 2.00, 'Grain Co'),
  ('Beef', 'kg', 15, 5, 5.50, 'Local Butcher'),
  ('Bread', 'pcs', 60, 15, 0.30, 'Bakery'),
  ('Lettuce', 'kg', 5, 1, 1.80, 'Fresh Farms'),
  ('Tomato', 'kg', 6, 1.5, 1.20, 'Fresh Farms'),
  ('Cheese', 'kg', 8, 2, 6.00, 'Dairy Co'),
  ('Milk', 'L', 20, 5, 1.10, 'Dairy Co'),
  ('Sugar', 'kg', 12, 3, 0.90, 'Grain Co'),
  ('Coffee Beans', 'kg', 6, 1.5, 9.00, 'Roasters Inc'),
  ('Orange', 'kg', 10, 2, 1.50, 'Fresh Farms'),
  ('Mango', 'kg', 8, 2, 2.00, 'Fresh Farms'),
  ('Ice', 'kg', 25, 5, 0.20, 'Local Supplier'),
  ('Coca Cola Syrup', 'L', 5, 1, 8.00, 'Beverage Co'),
  ('Potato', 'kg', 18, 4, 0.80, 'Fresh Farms');

insert into locations (code, name) values
  ('seat-01', 'Seat 01'),
  ('seat-02', 'Seat 02'),
  ('seat-03', 'Seat 03'),
  ('seat-04', 'Seat 04'),
  ('seat-05', 'Seat 05'),
  ('seat-06', 'Seat 06'),
  ('seat-07', 'Seat 07'),
  ('seat-08', 'Seat 08');

-- Products
insert into products (name, category_id, description, price, sku) values
  ('Chicken Meal', (select id from categories where name = 'Food'), 'Grilled chicken with rice', 6.50, 'FOOD-001'),
  ('Beef Burger', (select id from categories where name = 'Food'), 'Beef patty, lettuce, tomato, cheese, bread', 5.50, 'FOOD-002'),
  ('French Fries', (select id from categories where name = 'Snacks'), 'Crispy fried potato', 2.50, 'SNACK-001'),
  ('Espresso', (select id from categories where name = 'Coffee'), 'Single shot espresso', 1.80, 'COFFEE-001'),
  ('Cappuccino', (select id from categories where name = 'Coffee'), 'Espresso with steamed milk foam', 2.50, 'COFFEE-002'),
  ('Orange Juice', (select id from categories where name = 'Juice'), 'Freshly squeezed orange juice', 2.20, 'JUICE-001'),
  ('Mango Juice', (select id from categories where name = 'Juice'), 'Fresh mango juice', 2.20, 'JUICE-002'),
  ('Coca Cola', (select id from categories where name = 'Drinks'), 'Chilled soft drink', 1.50, 'DRINK-001'),
  ('Iced Milk', (select id from categories where name = 'Drinks'), 'Cold sweet milk with ice', 1.80, 'DRINK-002');

-- Recipes
insert into product_ingredients (product_id, ingredient_id, quantity)
select p.id, i.id, v.qty from (values
  ('Chicken Meal', 'Chicken', 0.25),
  ('Chicken Meal', 'Rice', 0.20),
  ('Chicken Meal', 'Cooking Oil', 0.03),
  ('Beef Burger', 'Beef', 0.15),
  ('Beef Burger', 'Bread', 1),
  ('Beef Burger', 'Lettuce', 0.03),
  ('Beef Burger', 'Tomato', 0.04),
  ('Beef Burger', 'Cheese', 0.02),
  ('French Fries', 'Potato', 0.25),
  ('French Fries', 'Cooking Oil', 0.05),
  ('Espresso', 'Coffee Beans', 0.018),
  ('Cappuccino', 'Coffee Beans', 0.018),
  ('Cappuccino', 'Milk', 0.12),
  ('Orange Juice', 'Orange', 0.35),
  ('Mango Juice', 'Mango', 0.30),
  ('Coca Cola', 'Coca Cola Syrup', 0.05),
  ('Coca Cola', 'Ice', 0.05),
  ('Iced Milk', 'Milk', 0.2),
  ('Iced Milk', 'Sugar', 0.02),
  ('Iced Milk', 'Ice', 0.05)
) as v(product_name, ingredient_name, qty)
join products p on p.name = v.product_name
join ingredients i on i.name = v.ingredient_name;

update settings set
  cafeteria_name = 'SANDBOX',
  address = '123 Main Street',
  phone = '+252 61 000 0000',
  currency = 'USD',
  receipt_header = 'SANDBOX CAFETERIA',
  receipt_footer = 'THANK YOU!'
where id = 1;

insert into printer_settings (name, width_mm, is_default, config) values
  ('Default 80mm Printer', 80, true, '{}'::jsonb);
