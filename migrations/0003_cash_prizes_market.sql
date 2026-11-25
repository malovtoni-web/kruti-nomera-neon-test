ALTER TABLE spin_history ADD COLUMN cash_prize INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS market_listings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 seller_telegram_id TEXT NOT NULL,
 buyer_telegram_id TEXT,
 plate TEXT NOT NULL,
 region TEXT NOT NULL,
 rarity TEXT NOT NULL,
 cls TEXT NOT NULL,
 value INTEGER NOT NULL,
 asking_price INTEGER NOT NULL CHECK(asking_price>0),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','sold','cancelled')),
 created_at INTEGER NOT NULL,
 sold_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_market_active ON market_listings(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_telegram_id,status);