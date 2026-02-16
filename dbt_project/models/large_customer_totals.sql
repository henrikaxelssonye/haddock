-- Customer totals aggregation for large dataset
SELECT
    c.ID as CustomerID,
    c.Name as CustomerName,
    c.Email,
    r.Name as RegionName,
    r.Country,
    COUNT(DISTINCT s.ID) as OrderCount,
    SUM(s.Quantity) as TotalItems,
    SUM(s.Quantity * p.Price) as TotalSpent
FROM {{ ref('large_customers') }} c
LEFT JOIN {{ ref('large_sales') }} s ON s.CustomerID = c.ID
LEFT JOIN {{ ref('large_products') }} p ON s.ProductID = p.ID
LEFT JOIN {{ ref('large_regions') }} r ON c.RegionID = r.ID
GROUP BY c.ID, c.Name, c.Email, r.Name, r.Country
