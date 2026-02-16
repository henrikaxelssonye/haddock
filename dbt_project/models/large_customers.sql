-- Generate 10,000 customers
WITH first_names AS (
    SELECT * FROM (VALUES
        ('Anna'), ('Erik'), ('Maria'), ('Johan'), ('Karin'),
        ('Lars'), ('Sofia'), ('Peter'), ('Emma'), ('Oscar'),
        ('Maja'), ('William'), ('Ella'), ('Lucas'), ('Alma'),
        ('Oliver'), ('Wilma'), ('Hugo'), ('Elsa'), ('Noah')
    ) AS t(first_name)
),
last_names AS (
    SELECT * FROM (VALUES
        ('Andersson'), ('Johansson'), ('Karlsson'), ('Nilsson'), ('Eriksson'),
        ('Larsson'), ('Olsson'), ('Persson'), ('Svensson'), ('Gustafsson'),
        ('Pettersson'), ('Jonsson'), ('Hansen'), ('Nielsen'), ('Berg'),
        ('Lindgren'), ('Lindqvist'), ('Lindstrom'), ('Magnusson'), ('Olsen')
    ) AS t(last_name)
),
customer_base AS (
    SELECT
        ROW_NUMBER() OVER () as row_num,
        first_name,
        last_name
    FROM first_names
    CROSS JOIN last_names
    CROSS JOIN generate_series(1, 25) as multiplier(n)
),
region_count AS (
    SELECT COUNT(*) as cnt FROM {{ ref('large_regions') }}
)
SELECT
    row_num as ID,
    first_name || ' ' || last_name || ' ' || row_num::VARCHAR as Name,
    LOWER(first_name || '.' || last_name || row_num::VARCHAR || '@example.com') as Email,
    ((row_num - 1) % (SELECT cnt FROM region_count)) + 1 as RegionID
FROM customer_base
WHERE row_num <= 10000
