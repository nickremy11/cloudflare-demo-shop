-- Seed data for the D1 storage demo (cloud-storage solution page).
-- Run once against the demo-d1 database:
--   npx wrangler d1 execute demo-d1 --remote --file=db/demo-d1-seed.sql
-- For local dev:
--   npx wrangler d1 execute demo-d1 --local --file=db/demo-d1-seed.sql

DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL,
  category  TEXT    NOT NULL,
  price     REAL    NOT NULL,
  stock     INTEGER NOT NULL DEFAULT 0
);

INSERT INTO products (id, name, category, price, stock) VALUES
  (1,  'Aurora Wireless Headphones', 'Audio',       129.99, 42),
  (2,  'Nimbus Bluetooth Speaker',   'Audio',        59.99, 130),
  (3,  'Pine Mechanical Keyboard',   'Peripherals',  89.00,  76),
  (4,  'Vector Wireless Mouse',      'Peripherals',  34.50, 210),
  (5,  'Halo 4K Webcam',             'Peripherals',  74.99,  18),
  (6,  'Slate 14" Laptop Stand',     'Accessories',  29.95, 305),
  (7,  'Cobalt USB-C Hub',           'Accessories',  44.00,  64),
  (8,  'Ember 65W GaN Charger',      'Accessories',  39.99, 142),
  (9,  'Drift Noise-Cancel Earbuds', 'Audio',        99.00,  53),
  (10, 'Lumen 27" 4K Monitor',       'Displays',    329.00,  12),
  (11, 'Lumen 24" QHD Monitor',      'Displays',    219.00,  27),
  (12, 'Quartz Webcam Ring Light',   'Accessories',  19.99, 188);
