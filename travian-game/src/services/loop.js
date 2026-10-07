// Game loop: periodically runs all engine ticks and spawns barbarian villages to keep the map alive.
const { db } = require('../db');
const engine = require('./engine');
const cfg = require('../config/game');
const V = require('../models/village');
const M = require('../models/map');

let timer = null;

const BARB_NAMES = ['Barbarian Camp', 'Oasis', 'Ruins', 'Fortress', 'Highland Village', 'Swamp Village', 'Forest Clearing'];

function spawnBarbarians(count) {
  for (let i = 0; i < count; i++) {
    try {
      const existing = db.prepare('SELECT x, y FROM villages ORDER BY RANDOM() LIMIT 10').all().map(v => [v.x, v.y]);
      const spot = M.findPlace(existing);
      const name = BARB_NAMES[Math.floor(Math.random() * BARB_NAMES.length)];
      V.createVillage(null, name, spot.x, spot.y, { npc: true, capital: false, population: 3 + Math.floor(Math.random() * 20) });
      // give NPC some troops sometimes
      if (Math.random() < 0.5) {
        const vid = db.prepare('SELECT id FROM villages WHERE x = ? AND y = ?').get(spot.x, spot.y).id;
        const unitKeys = ['legionnaire', 'imperian', 'pretorian'];
        const k = unitKeys[Math.floor(Math.random() * unitKeys.length)];
        const c = 5 + Math.floor(Math.random() * 40);
        db.prepare('INSERT INTO troops (village_id, key, count) VALUES (?, ?, ?)').run(vid, k, c);
        db.prepare(`UPDATE villages SET wood = ?, clay = ?, iron = ?, grain = ? WHERE id = ?`)
          .run(500 + Math.random() * 2000, 500 + Math.random() * 2000, 300 + Math.random() * 1500, 300 + Math.random() * 1000, vid);
      }
    } catch (e) { /* map full */ }
  }
}

function runAllTicks() {
  engine.tickResources();
  engine.tickBuildings();
  engine.tickTraining();
  engine.tickResearch();
  engine.tickPopulation();
  engine.tickNatives();
  engine.resolveMovements();
}

function start(intervalMs = 5000) {
  if (timer) return;
  timer = setInterval(runAllTicks, intervalMs);
  // seed barbarians in background occasionally
  setInterval(() => {
    const total = db.prepare('SELECT COUNT(*) c FROM villages').get().c;
    const target = Math.floor((cfg.mapWidth * cfg.mapHeight) / 60);
    if (total < target) spawnBarbarians(5);
  }, 15000);
}

function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { start, stop, runAllTicks, spawnBarbarians };
