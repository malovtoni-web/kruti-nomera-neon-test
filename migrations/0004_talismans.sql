CREATE TABLE IF NOT EXISTS player_talismans (
 telegram_id TEXT NOT NULL,
 talisman_id TEXT NOT NULL,
 acquired_at INTEGER NOT NULL,
 PRIMARY KEY(telegram_id,talisman_id)
);
ALTER TABLE player_profile ADD COLUMN equipped_talisman TEXT;
