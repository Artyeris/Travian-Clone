// Village model: creation, buildings, resources, storage, production helpers
const { db } = require('../db');
const cfg = require('../config/game');
const { buildings, getCost, getBuildTime } = require('../gamedata/buildings');

const now = () => Date.now();

function createVillage(userId, name, x, y, opts = {}) {
  const t = now();
  const info = db.prepare(`INSERT INTO villages (user_id, name, x, y, is_capital, wood, clay, iron, grain, population, next_pop_time, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, name, x, y, opts.capital === false ? 0 : 1,
      cfg.startResources.wood, cfg.startResources.clay, cfg.startResources.iron, cfg.grainStart,
      opts.population || cfg.startPopulation, t + popInterval(), t);
  const vid = info.lastInsertRowid;

  // Starting buildings on slots (3x3 grid around center slot 4)
  const startB = [
    ['main', 1, 4], ['woodcutter', 1, 0], ['claypit', 1, 1],
    ['ironmine', 1, 2], ['grainfield', 1, 3], ['warehouse', 1, 5],
    ['granary', 1, 6], ['residence', 1, 7],
  ];
  const ins = db.prepare('INSERT INTO buildings (village_id, key, level, slot) VALUES (?, ?, ?, ?)');
  for (const [k, lvl, slot] of startB) ins.run(vid, k, lvl, slot);
  if (opts.npc) {
    // NPC gets extra random buildings
    const extras = ['barracks', 'wall', 'market', 'blacksmith'];
    let slot = 8;
    for (const k of extras.slice(0, 2 + Math.floor(Math.random() * 3))) {
      ins.run(vid, k, 1 + Math.floor(Math.random() * 3), slot++);
    }
  }
  return getVillage(vid);
}

function popInterval() {
  return Math.floor(cfg.popIntervalBase / cfg.speed.population);
}

function getVillage(id) {
  return db.prepare('SELECT * FROM villages WHERE id = ?').get(id);
}

function getVillageByCoord(x, y) {
  return db.prepare('SELECT * FROM villages WHERE x = ? AND y = ?').get(x, y);
}

function getUserVillages(userId) {
  return db.prepare('SELECT * FROM villages WHERE user_id = ? ORDER BY is_capital DESC, id ASC').all(userId);
}

function setVillage(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return; // nothing to update
  const sets = keys.map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE villages SET ${sets} WHERE id = ?`).run(...keys.map(k => fields[k]), id);
}

function getBuildings(villageId) {
  return db.prepare('SELECT * FROM buildings WHERE village_id = ? ORDER BY slot').all(villageId);
}

function getBuilding(villageId, key) {
  return db.prepare('SELECT * FROM buildings WHERE village_id = ? AND key = ?').get(villageId, key);
}

function buildingLevel(villageId, key) {
  const b = getBuilding(villageId, key);
  return b ? b.level : 0;
}

// Storage capacity from main + warehouse
function getStorageCapacity(villageId) {
  const mainLvl = buildingLevel(villageId, 'main');
  const whLvl = buildingLevel(villageId, 'warehouse');
  const resLvl = buildingLevel(villageId, 'residence');
  const capFn = buildings.main.gives.storage;
  const whFn = buildings.warehouse.gives.storage;
  let cap = (mainLvl > 0 ? capFn(mainLvl) : 0) + (whLvl > 0 ? whFn(whLvl) : 0);
  if (resLvl > 0) cap += Math.floor(cap * 0.05 * resLvl);
  return Math.floor(cap);
}

function getGrainCapacity(villageId) {
  const gLvl = buildingLevel(villageId, 'granary');
  const resLvl = buildingLevel(villageId, 'residence');
  let cap = gLvl > 0 ? buildings.granary.gives.grainStorage(gLvl) : 0;
  if (resLvl > 0) cap += Math.floor(cap * 0.05 * resLvl);
  return Math.floor(cap);
}

function getHousing(villageId) {
  const mainLvl = buildingLevel(villageId, 'main');
  const resLvl = buildingLevel(villageId, 'residence');
  let h = 5 + (mainLvl > 0 ? Math.floor(5 + 3 * mainLvl + 0.3 * mainLvl * mainLvl) : 0);
  if (resLvl > 0) h += buildings.residence.gives.housing(resLvl);
  return h;
}

// Production per hour for each resource (accounting natives & research)
function getProduction(village) {
  const vid = village.id;
  const userId = village.user_id;
  let researchBonus = {};
  if (userId) {
    const rows = db.prepare('SELECT key, level FROM player_research WHERE user_id = ?').all(userId);
    for (const r of rows) researchBonus[r.key] = r.level;
  }
  const out = { wood: 0, clay: 0, iron: 0, grain: 0 };
  const bs = getBuildings(vid);
  for (const b of bs) {
    const def = buildings[b.key];
    if (!def || !def.production) continue;
    for (const res of Object.keys(def.production)) {
      const fn = def.production[res];
      if (typeof fn !== 'function') continue;
      let prod = fn(b.level);
      // native bonus: +10% per native level point over 1? classic: natives give % bonus. Simplify: nat_* is 1-5, add (nat-5)*2%
      const natKey = 'nat_' + res;
      if (village[natKey] != null) prod *= 1 + (village[natKey] - 5) * 0.02;
      // research bonuses
      if (res === 'wood' && researchBonus.logging) prod *= 1 + researchBonus.logging * 0.1;
      if (res === 'clay' && researchBonus.brick) prod *= 1 + researchBonus.brick * 0.1;
      if (res === 'iron' && researchBonus.mining) prod *= 1 + researchBonus.mining * 0.1;
      if (res === 'grain' && researchBonus.agriculture) prod *= 1 + researchBonus.agriculture * 0.1;
      out[res] += prod;
    }
  }
  // multiply by speed factor
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * cfg.speed.resource);
  return out;
}

// Grain consumption per hour by population and troops
function getGrainConsumption(village) {
  const { units } = require('../gamedata/units');
  const popCons = village.population * 1.0 * cfg.speed.grain; // 1 grain/hour per person-ish
  let troopCons = 0;
  const tr = db.prepare('SELECT key, count FROM troops WHERE village_id = ?').all(village.id);
  for (const t of tr) {
    const u = units[t.key];
    if (u) troopCons += u.grainUpkeep * t.count;
  }
  return popCons + troopCons;
}

function canAfford(village, cost) {
  return village.wood >= (cost.wood || 0) && village.clay >= (cost.clay || 0) && village.iron >= (cost.iron || 0);
}

function payCost(villageId, cost) {
  setVillage(villageId, {}); // noop to keep API
  db.prepare('UPDATE villages SET wood = wood - ?, clay = clay - ?, iron = iron - ? WHERE id = ?')
    .run(cost.wood || 0, cost.clay || 0, cost.iron || 0, villageId);
}

module.exports = {
  createVillage, getVillage, getVillageByCoord, getUserVillages, setVillage,
  getBuildings, getBuilding, buildingLevel, getStorageCapacity, getGrainCapacity,
  getHousing, getProduction, getGrainConsumption, canAfford, payCost,
  getCost, getBuildTime, buildings, now,
};
