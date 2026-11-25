-- Family backup: each linked phone keeps a compressed copy of all its data here, so a lost phone can be restored
-- onto a new one. Big backups are kept in parts.
CREATE TABLE backups (
  device_id TEXT NOT NULL REFERENCES devices(id),
  part INTEGER NOT NULL,
  parts INTEGER NOT NULL,
  data TEXT NOT NULL,
  app_version TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (device_id, part)
);

-- one-time codes another phone in the family makes, to put a lost phone's place onto a new phone
CREATE TABLE recovery_codes (
  code TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  device_id TEXT NOT NULL REFERENCES devices(id),
  created_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

-- a move between two shared accounts is listed under both
CREATE TABLE entry_accounts (
  entry_id TEXT NOT NULL REFERENCES entries(id),
  account_id TEXT NOT NULL REFERENCES shared_accounts(id),
  PRIMARY KEY (entry_id, account_id)
);
