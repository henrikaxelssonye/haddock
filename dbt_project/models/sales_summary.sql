SELECT
    s.ID as SaleID,
    s.SaleDate,
    s.Quantity,
    c.ID as CustomerID,
    c.Name as CustomerName,
    p.ID as ProductID,
    p.Name as ProductName,
    p.Category,
    p.Price,
    s.Quantity * p.Price as TotalAmount,
    r.ID as RegionID,
    r.Name as RegionName,
    r.Country
FROM {{ ref('sales') }} s
JOIN {{ ref('customers') }} c ON s.CustomerID = c.ID
JOIN {{ ref('products') }} p ON s.ProductID = p.ID
JOIN {{ ref('regions') }} r ON c.RegionID = r.ID
