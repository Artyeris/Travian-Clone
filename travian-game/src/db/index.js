// SQLite database setup with better-sqlite3
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'travian.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    tribe TEXT DEFAULT 'roman',
    created_at INTEGER NOT NULL,
    last_login INTEGER,
    banned INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS villages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,            -- null => barbarian NPC village
    name TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    is_capital INTEGER DEFAULT 1,
    wood REAL DEFAULT 0, clay REAL DEFAULT 0, iron REAL DEFAULT 0, grain REAL DEFAULT 0,
    population INTEGER DEFAULT 2,
    loyalty INTEGER DEFAULT 80,
    nat_wood INTEGER DEFAULT 5, nat_clay INTEGER DEFAULT 5, nat_iron INTEGER DEFAULT 5, nat_grain INTEGER DEFAULT 5,
    trader_interval INTEGER DEFAULT 0,
    next_pop_time INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_village_coord ON villages(x, y);

  CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    slot INTEGER NOT NULL DEFAULT 0,
    upgrading INTEGER DEFAULT 0,
    upgrade_finish INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_buildings_village ON buildings(village_id);

  CREATE TABLE IF NOT EXISTS troops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_troops_village_key ON troops(village_id, key);

  CREATE TABLE IF NOT EXISTS training (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    building_key TEXT NOT NULL,
    unit_key TEXT NOT NULL,
    amount INTEGER NOT NULL,
    finish_time INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_training_village ON training(village_id);

  CREATE TABLE IF NOT EXISTS research_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    village_id INTEGER NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    target_level INTEGER NOT NULL,
    finish_time INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS player_research (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, key)
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL,          -- attack | reinforce | return | trade | settle | spy
    from_village INTEGER NOT NULL,
    to_village INTEGER NOT NULL,
    arrive_time INTEGER NOT NULL,
    return_time INTEGER,
    units TEXT,                  -- JSON map of unit counts
    resources TEXT,              -- JSON map for trade/loot
    hero INTEGER DEFAULT 0,
    status TEXT DEFAULT 'outbound' -- outbound | returned
  );
  CREATE INDEX IF NOT EXISTS idx_movements_arrive ON movements(arrive_time, status);

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    time INTEGER NOT NULL,
    type TEXT NOT NULL,          -- attack | settle | trade | native | system
    title TEXT,
    body TEXT                    -- JSON payload for rendering
  );
  CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id, time);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user INTEGER,
    to_user INTEGER NOT NULL,
    subject TEXT,
    body TEXT,
    read INTEGER DEFAULT 0,
    time INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alliances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL,
    name TEXT NOT NULL,
    leader INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alliance_members (
    alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined INTEGER NOT NULL,
    PRIMARY KEY (alliance_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS diplomacy (
    alliance_a INTEGER NOT NULL,
    alliance_b INTEGER NOT NULL,
    status TEXT NOT NULL,        -- war | alliance | nap
    PRIMARY KEY (alliance_a, alliance_b)
  );

  CREATE TABLE IF NOT EXISTS heroes (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    attrs TEXT,                  -- JSON {str,int,agi,hp,maxhp}
    skills TEXT,                 -- JSON array of skill keys
    village_id INTEGER,
    equipment TEXT
  );

  CREATE TABLE IF NOT EXISTS market_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    village_id INTEGER NOT NULL,
    give_res TEXT NOT NULL, give_amount INTEGER NOT NULL,
    get_res TEXT NOT NULL, get_amount INTEGER NOT NULL,
    ratio REAL NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired INTEGER NOT NULL
  );
  `);
}

module.exports = { db, init };
