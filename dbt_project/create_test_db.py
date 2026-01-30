"""
Creates a clean test database for the Haddock associative engine.
Tables are placed in the main schema with clear relationship columns.
"""
import duckdb
import os

# Remove existing file if present
db_path = os.path.join(os.path.dirname(__file__), '..', 'test_data.duckdb')
if os.path.exists(db_path):
    os.remove(db_path)

conn = duckdb.connect(db_path)

# Create regions table
conn.execute("""
CREATE TABLE regions (
    ID INTEGER PRIMARY KEY,
    Name VARCHAR,
    Country VARCHAR
)
""")
conn.execute("""
INSERT INTO regions VALUES
    (1, 'North', 'Sweden'),
    (2, 'South', 'Sweden'),
    (3, 'East', 'Norway'),
    (4, 'West', 'Norway'),
    (5, 'Central', 'Denmark')
""")

# Create customers table with RegionID foreign key
conn.execute("""
CREATE TABLE customers (
    ID INTEGER PRIMARY KEY,
    Name VARCHAR,
    Email VARCHAR,
    RegionID INTEGER
)
""")
conn.execute("""
INSERT INTO customers VALUES
    (1, 'Anna Svensson', 'anna@example.com', 1),
    (2, 'Erik Johansson', 'erik@example.com', 1),
    (3, 'Maria Berg', 'maria@example.com', 2),
    (4, 'Johan Lindgren', 'johan@example.com', 3),
    (5, 'Karin Olsen', 'karin@example.com', 3),
    (6, 'Lars Hansen', 'lars@example.com', 4),
    (7, 'Sofia Nielsen', 'sofia@example.com', 5),
    (8, 'Peter Andersen', 'peter@example.com', 5)
""")

# Create products table
conn.execute("""
CREATE TABLE products (
    ID INTEGER PRIMARY KEY,
    Name VARCHAR,
    Category VARCHAR,
    Price DECIMAL(10,2)
)
""")
conn.execute("""
INSERT INTO products VALUES
    (1, 'Mountain Bike', 'Bikes', 4500),
    (2, 'Road Bike', 'Bikes', 5200),
    (3, 'Helmet', 'Accessories', 450),
    (4, 'Gloves', 'Accessories', 180),
    (5, 'Water Bottle', 'Accessories', 95),
    (6, 'Bike Lock', 'Accessories', 320),
    (7, 'Kids Bike', 'Bikes', 2200),
    (8, 'Electric Bike', 'Bikes', 12000)
""")

# Create sales table with CustomerID and ProductID foreign keys
conn.execute("""
CREATE TABLE sales (
    ID INTEGER PRIMARY KEY,
    CustomerID INTEGER,
    ProductID INTEGER,
    Quantity INTEGER,
    SaleDate DATE
)
""")
conn.execute("""
INSERT INTO sales VALUES
    (1, 1, 1, 1, '2024-01-15'),
    (2, 1, 3, 1, '2024-01-15'),
    (3, 2, 2, 1, '2024-01-18'),
    (4, 2, 4, 2, '2024-01-18'),
    (5, 3, 7, 1, '2024-02-01'),
    (6, 3, 5, 3, '2024-02-01'),
    (7, 4, 8, 1, '2024-02-10'),
    (8, 4, 3, 1, '2024-02-10'),
    (9, 4, 6, 1, '2024-02-10'),
    (10, 5, 1, 1, '2024-02-15'),
    (11, 5, 4, 1, '2024-02-15'),
    (12, 6, 2, 1, '2024-03-01'),
    (13, 7, 7, 2, '2024-03-05'),
    (14, 7, 5, 2, '2024-03-05'),
    (15, 8, 8, 1, '2024-03-10'),
    (16, 1, 5, 2, '2024-03-12'),
    (17, 2, 6, 1, '2024-03-15'),
    (18, 3, 3, 1, '2024-03-20')
""")

conn.close()

print(f"Created: {db_path}")

# Verify
conn = duckdb.connect(db_path, read_only=True)
print("\nTables:")
for row in conn.execute("SHOW TABLES").fetchall():
    count = conn.execute(f"SELECT COUNT(*) FROM {row[0]}").fetchone()[0]
    print(f"  {row[0]}: {count} rows")

print("\nRelationships (for associative filtering):")
print("  sales.CustomerID -> customers.ID")
print("  sales.ProductID -> products.ID")
print("  customers.RegionID -> regions.ID")

conn.close()
