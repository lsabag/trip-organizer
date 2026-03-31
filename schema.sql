CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT,
  time TEXT DEFAULT '08:00',
  meeting TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  hidden INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  creator_token TEXT NOT NULL,
  participants TEXT DEFAULT '[]',
  waypoints TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trips_hidden ON trips(hidden);
CREATE INDEX IF NOT EXISTS idx_trips_creator ON trips(creator_token);
