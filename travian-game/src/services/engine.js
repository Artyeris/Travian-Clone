// Core game engine: resource ticks, build completions, training, research, population, natives, movements & combat.
const { db } = require('../db');
const cfg = require('../config/game');
const V = require('../models/village');
const M = require('../models/map');
const { units, getTrainTime } = require('../gamedata/units');
const { buildings } = require('../gamedata/buildings');
const { research, getResearchCost, getResearchTime } = require('../gamedata/research');
const heroModel = require('../models/hero');
const nativesData = require('../gamedata/natives');

const now = () => Date.now();

function addReport(userId, type, title, body) {
  db.prepare('INSERT INTO reports (user_id, time, type, title, body) VALUES (?, ?, ?, ?, ?)')
    .run(userId, now(), type, title, JSON.stringify(body));
}

// ---------- Resource tick ----------
let lastTick = now();
function tickResources() {
  const t = now();
  const dtHours = (t - lastTick) / 3600000;
  if (dtHours <= 0) return;
  const villages = db.prepare('SELECT * FROM villages').all();
  for (const v of villages) {
    const prod = V.getProduction(v);
    const cons = V.getGrainConsumption(v);
    const cap = V.getStorageCapacity(v.id);
    const gcap = V.getGrainCapacity(v.id);
    let wood = Math.min(cap, v.wood + prod.wood * dtHours);
    let clay = Math.min(cap, v.clay + prod.clay * dtHours);
    let iron = Math.min(cap, v.iron + prod.iron * dtHours);
    // grain: production minus consumption; starvation reduces pop growth only
    let grain = v.grain + (prod.grain - cons) * dtHours;
    grain = Math.max(0, Math.min(gcap, grain));
    db.prepare('UPDATE villages SET wood=?, clay=?, iron=?, grain=? WHERE id=?').run(wood, clay, iron, grain, v.id);
  }
  lastTick = t;
}

// ---------- Population growth ----------
function tickPopulation() {
  const t = now();
  const rows = db.prepare('SELECT * FROM villages WHERE user_id IS NOT NULL AND next_pop_time <= ?').all(t);
  for (const v of rows) {
    const housing = V.getHousing(v.id);
    const need = Math.floor(cfg.popGrainNeedBase / cfg.speed.grain);
    if (v.population < housing && v.grain >= need) {
      db.prepare('UPDATE villages SET population = population + 1, grain = grain - ?, next_pop_time = ? WHERE id = ?')
        .run(need, t + Math.floor(cfg.popIntervalBase / cfg.speed.population), v.id);
    } else {
      // retry sooner
      db.prepare('UPDATE villages SET next_pop_time = ? WHERE id = ?').run(t + 60000, v.id);
    }
  }
}

// ---------- Natives (traders giving gifts) ----------
function tickNatives() {
  const t = now();
  const rows = db.prepare('SELECT * FROM villages WHERE user_id IS NOT NULL AND trader_interval > 0 AND trader_interval <= ?').all(t);
  for (const v of rows) {
    const gift = nativesData.randomGift();
    const cap = gift.res === 'grain' ? V.getGrainCapacity(v.id) : V.getStorageCapacity(v.id);
    const cur = v[gift.res];
    const add = Math.min(cap - cur, gift.amount);
    if (add > 0) {
      db.prepare(`UPDATE villages SET ${gift.res} = ${gift.res} + ? WHERE id = ?`).run(add, v.id);
      addReport(v.user_id, 'native', `${gift.name} visited`, { res: gift.res, amount: Math.floor(add) });
    }
    // schedule next visit in 2-6 hours
    db.prepare('UPDATE villages SET trader_interval = ? WHERE id = ?').run(t + (7200000 + Math.random() * 14400000), v.id);
  }
}

// ---------- Build queue completion ----------
function tickBuildings() {
  const t = now();
  const rows = db.prepare('SELECT b.*, v.user_id FROM buildings b JOIN villages v ON v.id = b.village_id WHERE b.upgrading = 1 AND b.upgrade_finish <= ?').all(t);
  for (const r of rows) {
    db.prepare('UPDATE buildings SET level = level + 1, upgrading = 0, upgrade_finish = 0 WHERE id = ?').run(r.id);
    if (r.user_id) addReport(r.user_id, 'system', `${V.buildings[r.key].name} upgraded`, { village: r.village_id, key: r.key, level: r.level + 1 });
  }
}

// ---------- Training completion ----------
function tickTraining() {
  const t = now();
  const rows = db.prepare('SELECT * FROM training WHERE finish_time <= ?').all(t);
  for (const r of rows) {
    // add all units at once (simplified vs per-unit timing)
    const existing = db.prepare('SELECT * FROM troops WHERE village_id = ? AND key = ?').get(r.village_id, r.unit_key);
    if (existing) db.prepare('UPDATE troops SET count = count + ? WHERE id = ?').run(r.amount, existing.id);
    else db.prepare('INSERT INTO troops (village_id, key, count) VALUES (?, ?, ?)').run(r.village_id, r.unit_key, r.amount);
    db.prepare('DELETE FROM training WHERE id = ?').run(r.id);
    const v = V.getVillage(r.village_id);
    if (v.user_id) addReport(v.user_id, 'system', `${r.amount}x ${units[r.unit_key].name} trained`, { village: r.village_id });
  }
}

// ---------- Research completion ----------
function tickResearch() {
  const t = now();
  const rows = db.prepare('SELECT rq.*, v.user_id FROM research_queue rq JOIN villages v ON v.id = rq.village_id WHERE rq.finish_time <= ?').all(t);
  for (const r of rows) {
    const cur = db.prepare('SELECT level FROM player_research WHERE user_id = ? AND key = ?').get(r.user_id, r.key);
    if (cur) db.prepare('UPDATE player_research SET level = ? WHERE user_id = ? AND key = ?').run(r.target_level, r.user_id, r.key);
    else db.prepare('INSERT INTO player_research (user_id, key, level) VALUES (?, ?, ?)').run(r.user_id, r.key, r.target_level);
    db.prepare('DELETE FROM research_queue WHERE id = ?').run(r.id);
    addReport(r.user_id, 'system', `Research complete: ${research[r.key].name}`, { level: r.target_level });
  }
}

// ---------- Movement resolution ----------
function resolveMovements() {
  const t = now();
  const rows = db.prepare("SELECT * FROM movements WHERE status = 'outbound' AND arrive_time <= ?").all(t);
  for (const mv of rows) {
    if (mv.type === 'attack' || mv.type === 'spy') resolveAttack(mv);
    else if (mv.type === 'reinforce') resolveReinforce(mv);
    else if (mv.type === 'return') resolveReturn(mv);
    else if (mv.type === 'trade') resolveTrade(mv);
    else if (mv.type === 'settle') resolveSettle(mv);
  }
}

function unitMapFromJson(s) { return s ? JSON.parse(s) : {}; }

function removeUnits(vid, map) {
  for (const [k, c] of Object.entries(map)) {
    db.prepare('UPDATE troops SET count = MAX(0, count - ?) WHERE village_id = ? AND key = ?').run(c, vid, k);
  }
}

function addUnits(vid, map) {
  for (const [k, c] of Object.entries(map)) {
    if (!c) continue;
    const ex = db.prepare('SELECT * FROM troops WHERE village_id = ? AND key = ?').get(vid, k);
    if (ex) db.prepare('UPDATE troops SET count = count + ? WHERE id = ?').run(c, ex.id);
    else db.prepare('INSERT INTO troops (village_id, key, count) VALUES (?, ?, ?)').run(vid, k, c);
  }
}

function getUnits(vid) {
  const out = {};
  for (const r of db.prepare('SELECT key, count FROM troops WHERE village_id = ?').all(vid)) out[r.key] = r.count;
  return out;
}

function computePower(unitCounts, isDefence, wallLvl, researchBonus = {}) {
  let power = 0;
  for (const [k, c] of Object.entries(unitCounts)) {
    const u = units[k];
    if (!u) continue;
    let val = isDefence ? u.defence : u.attack;
    if (u.type === 'cavalry' && researchBonus.horseback) val *= 1 + researchBonus.horseback * 0.05;
    power += val * c;
  }
  if (isDefence && wallLvl > 0) {
    const bonus = Math.min(cfg.wallCapLevel, wallLvl) * cfg.wallBonusBase;
    power *= (1 + bonus);
  }
  return power;
}

function resolveAttack(mv) {
  const from = V.getVillage(mv.from_village);
  const to = V.getVillage(mv.to_village);
  if (!to) { finishMove(mv); return; }
  const attackers = unitMapFromJson(mv.units);
  const defenders = getUnits(to.id);
  const attRes = researchBonusFor(from ? from.user_id : null);
  const defRes = researchBonusFor(to.user_id);
  const attPower = computePower(attackers, false, 0, attRes);
  const wallLvl = V.buildingLevel(to.id, 'wall');
  const defPower = computePower(defenders, true, wallLvl, defRes);

  const reportBody = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, attackers, defenders };

  if (attPower > defPower) {
    // attacker wins: wipe defenders partially (classic losses both sides ~ simplified)
    const losses = calcLosses(attackers, attackers, defenders, true);
    removeUnits(to.id, defenders); // all defenders die (simplified)
    removeUnits(from.id, losses.attackerLost);
    // loot resources
    let loot = { wood: 0, clay: 0, iron: 0, grain: 0 };
    const carry = totalCarry(attackers);
    if (to.user_id == null) {
      // barbarian village captured -> becomes player's
      db.prepare('UPDATE villages SET user_id = ?, loyalty = 80 WHERE id = ?').run(from.user_id, to.id);
      addUnits(to.id, attackers);
      removeUnits(from.id, attackers);
      if (mv.hero) { heroModel.moveHero(from.user_id, to.id); }
      addReport(from.user_id, 'settle', 'Barbarian village captured!', reportBody);
    } else {
      const cap = V.getStorageCapacity(to.id);
      const gcap = V.getGrainCapacity(to.id);
      loot.wood = Math.min(to.wood, Math.floor(cap * 0.2));
      loot.clay = Math.min(to.clay, Math.floor(cap * 0.2));
      loot.iron = Math.min(to.iron, Math.floor(cap * 0.2));
      loot.grain = Math.min(to.grain, Math.floor(gcap * 0.2));
      const limited = limitTo(loot, carry);
      db.prepare('UPDATE villages SET wood = wood - ?, clay = clay - ?, iron = iron - ?, grain = grain - ? WHERE id = ?')
        .run(limited.wood, limited.clay, limited.iron, limited.grain, to.id);
      // siege damage
      applySiegeDamage(to.id, attackers);
      addReport(to.user_id, 'attack', 'Your village was attacked! Defeat.', { ...reportBody, lost: defenders, loot: limited, wall: wallLvl });
      addReport(from.user_id, 'attack', 'Attack successful', { ...reportBody, lost: losses.attackerLost, loot: limited, won: true, defUser: to.user_id });
      // create return movement with loot and survivors
      const survivors = subtractMaps(attackers, losses.attackerLost);
      createReturn(mv, survivors, limited); // createReturn calls finishMove(mv)
      if (from.user_id) heroModel.addExp(from.user_id, Math.floor((limited.wood + limited.clay + limited.iron + limited.grain) * cfg.heroExpPerResource / 10));
      return; // movement already finished by createReturn
    }
  } else {
    // defender wins
    const losses = calcLosses(attackers, attackers, defenders, false);
    removeUnits(to.id, losses.defenderLost);
    removeUnits(from.id, attackers); // attackers wiped (simplified heavy loss)
    addReport(to.user_id, 'attack', 'Your village was attacked! Victory.', { ...reportBody, lost: losses.defenderLost, won: true });
    addReport(from.user_id, 'attack', 'Attack failed', { ...reportBody, lost: attackers, won: false, defUser: to.user_id });
    if (to.user_id) heroModel.addExp(to.user_id, 50);
  }
  finishMove(mv);
}

function researchBonusFor(userId) {
  if (!userId) return {};
  const out = {};
  for (const r of db.prepare('SELECT key, level FROM player_research WHERE user_id = ?').all(userId)) out[r.key] = r.level;
  return out;
}

function totalCarry(unitCounts) {
  let c = 0;
  for (const [k, n] of Object.entries(unitCounts)) { const u = units[k]; if (u) c += u.carry * n; }
  return c;
}

function limitTo(loot, carry) {
  const total = loot.wood + loot.clay + loot.iron + loot.grain;
  if (total <= carry) return loot;
  const f = carry / (total || 1);
  return { wood: Math.floor(loot.wood * f), clay: Math.floor(loot.clay * f), iron: Math.floor(loot.iron * f), grain: Math.floor(loot.grain * f) };
}

function applySiegeDamage(vid, attackers) {
  const bs = V.getBuildings(vid).filter(b => ['woodcutter','claypit','ironmine','grainfield','herbivore'].includes(b.key) && b.level > 1);
  for (const [k, n] of Object.entries(attackers)) {
    const u = units[k];
    if (!u || !u.siegeRes) continue;
    const power = u.siegeRes * n;
    let destroyed = Math.min(bs.length, Math.floor(power / 500));
    while (destroyed-- > 0) {
      const b = bs.shift();
      if (!b) break;
      db.prepare('UPDATE buildings SET level = MAX(1, level - 1), upgrading = 0, upgrade_finish = 0 WHERE id = ?').run(b.id);
    }
  }
}

function calcLosses(attSent, attackers, defenders, attackerWins) {
  // simplified deterministic-ish losses
  const ratio = attackerWins ? 0.05 : 0.9;
  const attackerLost = {};
  for (const [k, c] of Object.entries(attackers)) attackerLost[k] = Math.ceil(c * ratio);
  const defenderLost = {};
  const dratio = attackerWins ? 1.0 : 0.15;
  for (const [k, c] of Object.entries(defenders)) defenderLost[k] = Math.ceil(c * dratio);
  return { attackerLost, defenderLost };
}

function subtractMaps(a, b) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = Math.max(0, a[k] - (b[k] || 0));
  return out;
}

function createReturn(mv, unitsMap, lootMap) {
  const from = V.getVillage(mv.from_village);
  const to = V.getVillage(mv.to_village);
  const minSpeed = minUnitSpeed(unitsMap);
  const tt = M.travelTime(to.x, to.y, from.x, from.y, minSpeed);
  db.prepare(`INSERT INTO movements (user_id, type, from_village, to_village, arrive_time, units, resources, hero, status)
              VALUES (?, 'return', ?, ?, ?, ?, ?, ?, 'outbound')`)
    .run(mv.user_id, to.id, from.id, now() + tt, JSON.stringify(unitsMap), JSON.stringify(lootMap), mv.hero);
  finishMove(mv);
}

function minUnitSpeed(unitCounts) {
  let sp = Infinity;
  for (const k of Object.keys(unitCounts)) { const u = units[k]; if (u && u.speed < sp) sp = u.speed; }
  return sp === Infinity ? 5 : sp;
}

function resolveReinforce(mv) {
  const map = unitMapFromJson(mv.units);
  addUnits(mv.to_village, map);
  removeUnits(mv.from_village, map);
  if (mv.hero) {
    const from = V.getVillage(mv.from_village);
    if (from && from.user_id) heroModel.moveHero(from.user_id, mv.to_village);
  }
  finishMove(mv);
}

function resolveReturn(mv) {
  const map = unitMapFromJson(mv.units);
  addUnits(mv.to_village, map);
  const loot = mv.resources ? JSON.parse(mv.resources) : null;
  if (loot) {
    const v = V.getVillage(mv.to_village);
    const cap = V.getStorageCapacity(v.id);
    const gcap = V.getGrainCapacity(v.id);
    db.prepare('UPDATE villages SET wood = MIN(?, wood + ?), clay = MIN(?, clay + ?), iron = MIN(?, iron + ?), grain = MIN(?, grain + ?) WHERE id = ?')
      .run(cap, loot.wood || 0, cap, loot.clay || 0, cap, loot.iron || 0, gcap, loot.grain || 0, v.id);
    const owner = V.getVillage(mv.to_village);
    if (owner.user_id) addReport(owner.user_id, 'trade', 'Resources arrived home', loot);
  }
  if (mv.hero) {
    const v = V.getVillage(mv.to_village);
    if (v.user_id) heroModel.moveHero(v.user_id, v.id);
  }
  finishMove(mv);
}

function resolveTrade(mv) {
  const from = V.getVillage(mv.from_village);
  const to = V.getVillage(mv.to_village);
  const res = JSON.parse(mv.resources || '{}');
  if (to) {
    const cap = V.getStorageCapacity(to.id);
    db.prepare('UPDATE villages SET wood = MIN(?, wood + ?), clay = MIN(?, clay + ?), iron = MIN(?, iron + ?) WHERE id = ?')
      .run(cap, res.wood || 0, cap, res.clay || 0, cap, res.iron || 0, to.id);
    if (to.user_id) addReport(to.user_id, 'trade', `Received trade from ${from ? from.name : '?'}`, res);
  }
  finishMove(mv);
}

function resolveSettle(mv) {
  const to = V.getVillage(mv.to_village);
  const from = V.getVillage(mv.from_village);
  if (!to || to.user_id) { // target must be empty coord -> stored as pseudo? handled in route by creating NPC-less spot
    finishMove(mv); return;
  }
  // convert the (barbarian) village to player's new village
  db.prepare('UPDATE villages SET user_id = ?, name = ?, loyalty = 100 WHERE id = ?').run(from.user_id, to.name, to.id);
  const unitsMap = unitMapFromJson(mv.units);
  removeUnits(from.id, { settler: unitsMap.settler || 1 });
  addReport(from.user_id, 'settle', 'New village founded', { x: to.x, y: to.y, name: to.name });
  finishMove(mv);
}

function finishMove(mv) {
  db.prepare("UPDATE movements SET status = 'returned' WHERE id = ?").run(mv.id);
}

// ---------- Public API to start actions ----------
function startBuild(villageId, key) {
  const v = V.getVillage(villageId);
  const b = V.getBuilding(villageId, key);
  const def = buildings[key];
  if (!def) return { error: 'Unknown building' };
  if (!b) return { error: 'Building not present on this island' };
  if (b.upgrading) return { error: 'Already upgrading' };
  if (b.level >= def.maxLevel) return { error: 'Max level reached' };
  if (def.requires) {
    for (const [rk, rl] of Object.entries(def.requires)) {
      if (V.buildingLevel(villageId, rk) < rl) return { error: `Requires ${buildings[rk].name} level ${rl}` };
    }
  }
  const cost = V.getCost(key, b.level);
  if (!V.canAfford(v, cost)) return { error: 'Not enough resources' };
  V.payCost(villageId, cost);
  const time = V.getBuildTime(key, b.level, cfg.speed.build);
  db.prepare('UPDATE buildings SET upgrading = 1, upgrade_finish = ? WHERE id = ?').run(now() + time, b.id);
  return { ok: true, finish: now() + time, cost, time };
}

function startTraining(villageId, unitKey, amount) {
  const v = V.getVillage(villageId);
  const u = units[unitKey];
  if (!u) return { error: 'Unknown unit' };
  if (V.buildingLevel(villageId, u.building) < 1) return { error: `Requires ${buildings[u.building].name}` };
  if (u.requires) {
    for (const [rk, rl] of Object.entries(u.requires)) {
      if (V.buildingLevel(villageId, rk) < rl) return { error: `Requires ${buildings[rk].name} level ${rl}` };
    }
  }
  const cost = { wood: u.cost.wood * amount, clay: u.cost.clay * amount, iron: u.cost.iron * amount };
  if (!V.canAfford(v, cost)) return { error: 'Not enough resources' };
  const housing = V.getHousing(villageId);
  const usedPop = troopPopulation(villageId) + v.population;
  if (usedPop + u.pop * amount > housing) return { error: 'Not enough free houses' };
  V.payCost(villageId, cost);
  const time = getTrainTime(unitKey, cfg.speed.troop) * amount;
  db.prepare('INSERT INTO training (village_id, building_key, unit_key, amount, finish_time) VALUES (?, ?, ?, ?, ?)')
    .run(villageId, u.building, unitKey, amount, now() + time);
  return { ok: true, finish: now() + time, cost };
}

function troopPopulation(villageId) {
  let p = 0;
  for (const r of db.prepare('SELECT key, count FROM troops WHERE village_id = ?').all(villageId)) {
    const u = units[r.key];
    if (u) p += u.pop * r.count;
  }
  return p;
}

function startResearch(userId, villageId, key) {
  const v = V.getVillage(villageId);
  const r = research[key];
  if (!r) return { error: 'Unknown research' };
  if (V.buildingLevel(villageId, 'academy') < 1) return { error: 'Requires Academy' };
  const cur = db.prepare('SELECT level FROM player_research WHERE user_id = ? AND key = ?').get(userId, key);
  const lvl = cur ? cur.level : 0;
  if (lvl >= r.maxLevel) return { error: 'Max level' };
  const cost = getResearchCost(key, lvl);
  if (!V.canAfford(v, cost)) return { error: 'Not enough resources' };
  const pending = db.prepare('SELECT * FROM research_queue WHERE village_id = ?').get(villageId);
  if (pending) return { error: 'Academy busy' };
  V.payCost(villageId, cost);
  const time = getResearchTime(key, lvl);
  db.prepare('INSERT INTO research_queue (village_id, key, target_level, finish_time) VALUES (?, ?, ?, ?)')
    .run(villageId, key, lvl + 1, now() + time);
  return { ok: true, finish: now() + time, cost };
}

module.exports = {
  tickResources, tickPopulation, tickNatives, tickBuildings, tickTraining, tickResearch, resolveMovements,
  startBuild, startTraining, startResearch, troopPopulation, addReport, getUnits, addUnits, removeUnits,
};
