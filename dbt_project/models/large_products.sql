-- Generate 500 products across various categories
WITH categories AS (
    SELECT * FROM (VALUES
        ('Bikes', 2000, 15000),
        ('Accessories', 50, 500),
        ('Clothing', 100, 800),
        ('Parts', 20, 1500),
        ('Electronics', 100, 2000)
    ) AS t(category, min_price, max_price)
),
product_prefixes AS (
    SELECT * FROM (VALUES
        ('Pro'), ('Elite'), ('Sport'), ('Basic'), ('Premium'),
        ('Ultra'), ('Classic'), ('Modern'), ('Vintage'), ('Future')
    ) AS t(prefix)
),
product_names AS (
    SELECT * FROM (VALUES
        ('Racer'), ('Cruiser'), ('Explorer'), ('Commuter'), ('Trail'),
        ('Urban'), ('Adventure'), ('Speed'), ('Comfort'), ('Power')
    ) AS t(product_name)
),
product_base AS (
    SELECT
        ROW_NUMBER() OVER () as row_num,
        prefix,
        product_name,
        category,
        min_price,
        max_price
    FROM categories
    CROSS JOIN product_prefixes
    CROSS JOIN product_names
)
SELECT
    row_num as ID,
    prefix || ' ' || product_name || ' ' || category as Name,
    category as Category,
    ROUND(min_price + (RANDOM() * (max_price - min_price)))::INTEGER as Price
FROM product_base
WHERE row_num <= 500
