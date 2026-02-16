-- Generate 50 regions across multiple countries
WITH countries AS (
    SELECT * FROM (VALUES
        ('Sweden'), ('Norway'), ('Denmark'), ('Finland'), ('Iceland'),
        ('Germany'), ('France'), ('Spain'), ('Italy'), ('UK')
    ) AS t(country)
),
region_names AS (
    SELECT * FROM (VALUES
        ('North'), ('South'), ('East'), ('West'), ('Central')
    ) AS t(region_name)
)
SELECT
    ROW_NUMBER() OVER () as ID,
    region_name || ' ' || country as Name,
    country as Country
FROM countries
CROSS JOIN region_names
