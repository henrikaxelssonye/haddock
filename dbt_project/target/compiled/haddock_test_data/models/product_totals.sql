SELECT
    p.ID as ProductID,
    p.Name as ProductName,
    p.Category,
    p.Price,
    COUNT(DISTINCT s.ID) as TimesSold,
    COUNT(DISTINCT s.CustomerID) as UniqueCustomers,
    SUM(s.Quantity) as TotalQuantity,
    SUM(s.Quantity * p.Price) as TotalRevenue
FROM "test_data"."main_main"."products" p
LEFT JOIN "test_data"."main_main"."sales" s ON s.ProductID = p.ID
GROUP BY p.ID, p.Name, p.Category, p.Price