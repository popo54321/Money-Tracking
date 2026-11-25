-- Shared accounts between linked phones (up to 10 per group). Only shared accounts and their entries are kept here.

-- a family of linked phones; the phone that made it is its owner
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  owner_device TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- each linked phone: it proves who it is with a secret only it holds (only its hash is stored)
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  removed_at INTEGER
);
CREATE INDEX devices_group ON devices(group_id);

-- short-lived codes the owner shows to link a new phone
CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  expires_at INTEGER NOT NULL,
  used_by TEXT
);

-- an account shared by its owner with chosen phones (`members`: JSON list of device ids)
CREATE TABLE shared_accounts (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  owner_device TEXT NOT NULL,
  members TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  removed_at INTEGER
);
CREATE INDEX shared_accounts_group ON shared_accounts(group_id);

-- entries on shared accounts: everyone sees them, only the phone that wrote one can change it
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES shared_accounts(id),
  author_device TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX entries_account ON entries(account_id, updated_at);
