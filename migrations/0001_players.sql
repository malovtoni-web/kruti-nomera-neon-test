CREATE TABLE IF NOT EXISTS players (
  telegram_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 240364,
  coins INTEGER NOT NULL DEFAULT 1250,
  stars INTEGER NOT NULL DEFAULT 0,
  energy INTEGER NOT NULL DEFAULT 25 CHECK (energy >= 0 AND energy <= 25),
  energy_updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  trial_at INTEGER NOT NULL DEFAULT 0,
  garage_json TEXT NOT NULL DEFAULT '[]',
  house_level INTEGER NOT NULL DEFAULT 1 CHECK (house_level BETWEEN 1 AND 5),
  cars_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS players_balance_idx ON players(balance DESC);
