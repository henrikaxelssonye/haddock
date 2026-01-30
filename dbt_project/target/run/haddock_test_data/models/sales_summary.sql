
  
  create view "test_data"."main"."sales_summary__dbt_tmp" as (
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
FROM "test_data"."main_main"."sales" s
JOIN "test_data"."main_main"."customers" c ON s.CustomerID = c.ID
JOIN "test_data"."main_main"."products" p ON s.ProductID = p.ID
JOIN "test_data"."main_main"."regions" r ON c.RegionID = r.ID
  );
