// Map helpers: coordinate lookup, random placement of new villages near existing ones
const { db } = require('../db');
const cfg = require('../config/game');

function coordOccupied(x, y) {
  return !!db.prepare('SELECT 1 FROM villages WHERE x = ? AND y = ?').get(x, y);
}

// Find a free spot for a new village; prefer near origin/other player villages (classic spreading)
function findPlace(nearby = []) {
  const W = cfg.mapWidth, H = cfg.mapHeight;
  // Try near provided coordinates first
  for (let attempt = 0; attempt < 50; attempt++) {
    if (nearby.length && Math.random() < cfg.barbarianNearbyChance + 0.4) {
      const [cx, cy] = nearby[Math.floor(Math.random() * nearby.length)];
      const r = 3 + Math.floor(Math.random() * 20);
      const ang = Math.random() * Math.PI * 2;
      const x = Math.round(cx + Math.cos(ang) * r);
      const y = Math.round(cy + Math.sin(ang) * r);
      if (x >= 0 && y >= 0 && x < W && y < H && !coordOccupied(x, y)) return { x, y };
    } else {
      const x = Math.floor(Math.random() * W);
      const y = Math.floor(Math.random() * H);
      if (!coordOccupied(x, y)) return { x, y };
    }
  }
  // Fallback: scan
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!coordOccupied(x, y)) return { x, y };
  throw new Error('Map full');
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Travel time in ms between coords at given unit speed with speed factor
function travelTime(x1, y1, x2, y2, unitSpeed, speedFactor) {
  const dist = distance(x1, y1, x2, y2);
  const sf = speedFactor || cfg.speed.unitSpeed;
  // base: unitSpeed tiles per hour => ms per tile = 3600000 / unitSpeed
  return Math.floor((dist * 3600000) / (unitSpeed * sf));
}

function getVillagesInBounds(minX, minY, maxX, maxY) {
  return db.prepare('SELECT id, user_id, name, x, y, is_capital FROM villages WHERE x BETWEEN ? AND ? AND y BETWEEN ? AND ?')
    .all(minX, maxX, minY, maxY);
}

module.exports = { coordOccupied, findPlace, distance, travelTime, getVillagesInBounds };
