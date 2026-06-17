-- Run this SQL in your InsForge / Postgres dashboard to create the schema.

CREATE TABLE IF NOT EXISTS listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mls_number        TEXT UNIQUE,
  source            TEXT NOT NULL DEFAULT 'flexmls' CHECK (source IN ('flexmls', 'manual')),
  deal_side         TEXT NOT NULL DEFAULT 'seller' CHECK (deal_side IN ('buyer', 'seller')),
  address           TEXT NOT NULL DEFAULT '',
  city              TEXT NOT NULL DEFAULT '',
  state             TEXT NOT NULL DEFAULT '',
  zip               TEXT NOT NULL DEFAULT '',
  price             INTEGER,
  status            TEXT NOT NULL CHECK (status IN ('New Listing', 'Pending', 'Coming Soon', 'Closed')),
  agent_name        TEXT NOT NULL DEFAULT '',
  bedrooms          NUMERIC,
  bathrooms         NUMERIC,
  sqft_or_acreage   TEXT,
  mls_description   TEXT,
  generated_caption TEXT,
  is_luxury         BOOLEAN NOT NULL DEFAULT FALSE,
  photo_url         TEXT,
  email_received_at TIMESTAMPTZ,
  build_status      TEXT NOT NULL DEFAULT 'ready' CHECK (build_status IN ('ready', 'built', 'posted', 'error')),
  canva_design_id   TEXT,
  canva_export_url  TEXT,
  posted_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT UNIQUE NOT NULL,
  email                    TEXT NOT NULL DEFAULT '',
  phone                    TEXT NOT NULL DEFAULT '',
  canva_headshot_asset_id  TEXT NOT NULL DEFAULT '',
  instagram_handle         TEXT
);

CREATE TABLE IF NOT EXISTS listing_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  slot          TEXT NOT NULL CHECK (slot IN ('living_room', 'kitchen', 'dining_room', 'bedroom', 'bathroom', 'highlight')),
  original_url  TEXT NOT NULL,
  processed_url TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, slot)
);

-- Trigger to keep updated_at current on listings
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listings_updated_at ON listings;
CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
