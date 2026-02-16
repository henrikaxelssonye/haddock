-- Monthly sales aggregated by region and category
SELECT
    DATE_TRUNC('month', s.SaleDate) as Month,
    r.Country,
    r.Name as RegionName,
    p.Category,
    COUNT(DISTINCT s.ID) as SalesCount,
    COUNT(DISTINCT s.CustomerID) as UniqueCustomers,
    SUM(s.Quantity) as TotalQuantity,
    SUM(s.Quantity * p.Price) as TotalRevenue
FROM {{ ref('large_sales') }} s
JOIN {{ ref('large_customers') }} c ON s.CustomerID = c.ID
JOIN {{ ref('large_products') }} p ON s.ProductID = p.ID
JOIN {{ ref('large_regions') }} r ON c.RegionID = r.ID
GROUP BY DATE_TRUNC('month', s.SaleDate), r.Country, r.Name, p.Category
ORDER BY Month, r.Country, r.Name, p.Category
