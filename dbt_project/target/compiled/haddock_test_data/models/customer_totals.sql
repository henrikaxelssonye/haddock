SELECT
    c.ID as CustomerID,
    c.Name as CustomerName,
    c.Email,
    r.Name as RegionName,
    r.Country,
    COUNT(DISTINCT s.ID) as OrderCount,
    SUM(s.Quantity) as TotalItems,
    SUM(s.Quantity * p.Price) as TotalSpent
FROM "test_data"."main_main"."customers" c
LEFT JOIN "test_data"."main_main"."sales" s ON s.CustomerID = c.ID
LEFT JOIN "test_data"."main_main"."products" p ON s.ProductID = p.ID
LEFT JOIN "test_data"."main_main"."regions" r ON c.RegionID = r.ID
GROUP BY c.ID, c.Name, c.Email, r.Name, r.Country