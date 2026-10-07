// Main game routes: overview, village (build), resource page, etc.
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const V = require('../models/village');
const engine = require('../services/engine');
const cfg = require('../config/game');
const userModel = require('../models/user');

function fmt(n) { return Math.floor(n).toLocaleString(); }

// Village switcher from the resource bar dropdown
router.get('/jump', (req, res) => {
  const userId = req.session.userId;
  const vid = Number(req.query.v);
  const v = V.getVillage(vid);
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  res.redirect(`/game/village/${v.id}`);
});

router.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/game/overview');
  const villages = V.getUserVillages(req.session.userId);
  if (!villages.length) return res.redirect('/game/overview');
  res.redirect(`/game/village/${villages[0].id}`);
});

router.get('/overview', (req, res) => {
  const userId = req.session.userId;
  let villages = [], reports = [];
  if (userId) {
    villages = V.getUserVillages(userId);
    reports = db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY time DESC LIMIT 15').all(userId);
  }
  const totalTroops = villages.reduce((s, v) => {
    const rows = db.prepare('SELECT SUM(count) c FROM troops WHERE village_id = ?').get(v.id);
    return s + (rows.c || 0);
  }, 0);
  const movements = userId
    ? db.prepare(`SELECT m.*, fv.name fv_name, fv.x fx, fv.y fy, tv.name tv_name, tv.x tx, tv.y ty
                  FROM movements m JOIN villages fv ON fv.id = m.from_village JOIN villages tv ON tv.id = m.to_village
                  WHERE m.user_id = ? AND m.status = 'outbound' ORDER BY m.arrive_time`).all(userId)
    : [];
  res.render('game/overview', {
    villages, reports: reports.map(r => ({ ...r, body: JSON.parse(r.body || '{}') })),
    movements, totalTroops, fmt, activeNav: 'overview', title: 'Overview',
  });
});

router.get('/village/:id', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.id));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const buildings = V.getBuildings(v.id);
  const prod = V.getProduction(v);
  const cons = V.getGrainConsumption(v);
  const cap = V.getStorageCapacity(v.id);
  const gcap = V.getGrainCapacity(v.id);
  const housing = V.getHousing(v.id);
  const troopPop = engine.troopPopulation(v.id);
  // available building slots per Travian island logic: group by type area. We'll show all buildable not yet present.
  const presentKeys = new Set(buildings.map(b => b.key));
  const resSlots = buildings.filter(b => ['woodcutter','claypit','ironmine','grainfield','herbivore'].includes(b.key)).length;
  const canAddNewField = resSlots < 20 && V.buildingLevel(v.id, 'main') >= 1;
  // candidates for NEW construction (not yet present in village)
  const { buildings: defs } = V;
  const newCandidates = Object.values(defs).filter(d => !presentKeys.has(d.key));
  const troopsHere = engine.getUnits(v.id);
  res.render('game/village', {
    v, buildings, prod, cons, cap, gcap, housing, troopPop, fmt, title: v.name,
    V_getCost: (k, l) => V.getCost(k, l),
    V_getBuildTime: (k, l) => V.getBuildTime(k, l, cfg.speed.build),
    newCandidates, defByName: defs, troopsHere, error: req.query.error || null,
    canAddNewField, cfgSpeed: cfg.speed, activeNav: 'village', currentVillages: V.getUserVillages(userId),
  });
});

// Upgrade a building
router.post('/village/:id/build/:key', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.id));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const result = engine.startBuild(v.id, req.params.key);
  req.flash = null;
  if (result.error) {
    return res.redirect(`/game/village/${v.id}?error=${encodeURIComponent(result.error)}`);
  }
  res.redirect(`/game/village/${v.id}`);
});

// Build a NEW building on free slot (assign next slot in its "island")
router.post('/village/:id/newbuilding/:key', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.id));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const key = req.params.key;
  const def = V.buildings[key];
  if (!def) return res.redirect(`/game/village/${v.id}?error=Unknown`);
  const existing = V.getBuilding(v.id, key);
  if (existing) return res.redirect(`/game/village/${v.id}?error=Already built`);
  // check requirements
  if (def.requires) {
    for (const [rk, rl] of Object.entries(def.requires)) {
      if (V.buildingLevel(v.id, rk) < rl) return res.redirect(`/game/village/${v.id}?error=Requires ${def.name} prereq`);
    }
  }
  const cost = V.getCost(key, 0);
  if (!V.canAfford(v, cost)) return res.redirect(`/game/village/${v.id}?error=Not enough resources`);
  V.payCost(v.id, cost);
  const maxSlot = db.prepare('SELECT MAX(slot) m FROM buildings WHERE village_id = ?').get(v.id).m || 0;
  const time = V.getBuildTime(key, 0, cfg.speed.build);
  db.prepare('INSERT INTO buildings (village_id, key, level, slot, upgrading, upgrade_finish) VALUES (?, ?, 0, ?, 1, ?)')
    .run(v.id, key, maxSlot + 1, Date.now() + time);
  res.redirect(`/game/village/${v.id}`);
});

module.exports = router;
