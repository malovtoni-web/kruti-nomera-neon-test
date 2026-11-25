CREATE TABLE IF NOT EXISTS player_daily (
  telegram_id TEXT PRIMARY KEY,
  last_claim_day TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  last_wheel_day TEXT
);

CREATE TABLE IF NOT EXISTS player_tasks (
  telegram_id TEXT NOT NULL,
  task_date TEXT NOT NULL,
  spins_count INTEGER NOT NULL DEFAULT 0,
  wheel_count INTEGER NOT NULL DEFAULT 0,
  claimed_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (telegram_id, task_date)
);

CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  reward_type TEXT NOT NULL,
  reward_amount INTEGER NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1000,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  code TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL,
  PRIMARY KEY (code, telegram_id)
);

CREATE TABLE IF NOT EXISTS spin_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  plate TEXT NOT NULL,
  region TEXT NOT NULL,
  rarity TEXT NOT NULL,
  cls TEXT NOT NULL,
  value INTEGER NOT NULL,
  crate_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spin_history_player ON spin_history(telegram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS player_cosmetics (
  telegram_id TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  purchased_at INTEGER NOT NULL,
  PRIMARY KEY (telegram_id, cosmetic_id)
);

CREATE TABLE IF NOT EXISTS player_profile (
  telegram_id TEXT PRIMARY KEY,
  equipped_plate TEXT,
  equipped_effect TEXT,
  equipped_theme TEXT,
  vip_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS star_payments (
  telegram_payment_charge_id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO promo_codes(code,reward_type,reward_amount,max_uses,uses,expires_at)
VALUES ('START777','coins',777,10000,0,NULL);
INSERT OR IGNORE INTO promo_codes(code,reward_type,reward_amount,max_uses,uses,expires_at)
VALUES ('NEON2026','balance',50000,10000,0,NULL);
