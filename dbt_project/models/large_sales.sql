-- Generate 500,000 sales transactions
WITH date_range AS (
    SELECT
        DATE '2022-01-01' + (i * INTERVAL '1 day') as sale_date
    FROM generate_series(0, 730) as t(i)  -- ~2 years of dates
),
customer_count AS (
    SELECT COUNT(*) as cnt FROM {{ ref('large_customers') }}
),
product_count AS (
    SELECT COUNT(*) as cnt FROM {{ ref('large_products') }}
),
sales_base AS (
    SELECT
        ROW_NUMBER() OVER () as ID,
        sale_date,
        ((RANDOM() * ((SELECT cnt FROM customer_count) - 1))::INTEGER) + 1 as CustomerID,
        ((RANDOM() * ((SELECT cnt FROM product_count) - 1))::INTEGER) + 1 as ProductID,
        (RANDOM() * 4 + 1)::INTEGER as Quantity
    FROM date_range
    CROSS JOIN generate_series(1, 685) as multiplier(n)  -- ~685 sales per day = 500k total
)
SELECT
    ID,
    CustomerID,
    ProductID,
    Quantity,
    sale_date as SaleDate
FROM sales_base
WHERE ID <= 500000
