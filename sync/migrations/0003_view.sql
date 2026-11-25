-- Family view: which phones may see a phone's whole money (read-only), set by the family's owner.
-- NULL = every phone in the family; otherwise a JSON list of device ids.
ALTER TABLE devices ADD COLUMN view_by TEXT;
