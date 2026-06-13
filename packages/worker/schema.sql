CREATE TABLE IF NOT EXISTS customers (
  CustomerID  TEXT PRIMARY KEY,
  Segment     TEXT NOT NULL,
  RecencyScore     INTEGER,
  FrequencyScore   INTEGER,
  MonetaryScore    INTEGER,
  DaySinceLastTxn  INTEGER,
  NoOfTxn          INTEGER,
  TotalSpending    REAL,
  AvgOrderValue    REAL
);

CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  MemberID    TEXT NOT NULL,
  OrderID     TEXT NOT NULL,
  Timestamp   TEXT NOT NULL,
  NetPrice    REAL NOT NULL,
  Quantity    INTEGER NOT NULL,
  ProductID   TEXT NOT NULL,
  ProductName TEXT NOT NULL,
  Category    TEXT NOT NULL,
  Gender      TEXT
);

CREATE INDEX IF NOT EXISTS idx_txns_member ON transactions(MemberID);
CREATE INDEX IF NOT EXISTS idx_txns_timestamp ON transactions(Timestamp);
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(Segment);
