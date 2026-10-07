// Barracks / Stable / Workshop training routes (generic troop trainer)
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const V = require('../models/village');
const engine = require('../services/engine');
const { units, getTrainTime } = require('../gamedata/units');
const cfg = require('../config/game');

const buildingToUnits = {
  barracks: ['legionnaire', 'pretorian', 'imperian', 'settler'],
  stable: ['eques', 'eques_legio', 'parthian', 'chariot'],
  workshop: ['ram', 'catapult', 'trebuchet', 'onager'],
};

router.get('/:villageId/:buildingKey', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const bKey = req.params.buildingKey;
  if (!buildingToUnits[bKey]) return res.redirect(`/game/village/${v.id}`);
  const level = V.buildingLevel(v.id, bKey);
  const queue = db.prepare('SELECT * FROM training WHERE village_id = ? AND building_key = ? ORDER BY finish_time').all(v.id, bKey);
  const housed = V.getHousing(v.id);
  const usedPop = v.population + engine.troopPopulation(v.id);
  const troops = engine.getUnits(v.id);
  const { buildings: defs } = require('../gamedata/buildings');
  res.render('game/barracks', {
    v, bKey, level, queue, troops, fmt: n => Math.floor(n).toLocaleString(),
    title: defs[bKey].name,
    defByName: defs, V_buildingLevel: (vid, k) => V.buildingLevel(vid, k),
    error: req.query.error || null,
    unitDefs: Object.fromEntries(Object.entries(units).map(([k, u]) => [k, u])),
    availableKeys: buildingToUnits[bKey],
    trainTime: (key) => getTrainTime(key, cfg.speed.troop),
    freePop: housed - usedPop, activeNav: 'troops', currentVillages: V.getUserVillages(userId),
  });
});

router.post('/:villageId/:buildingKey/train', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const amount = parseInt(req.body.amount, 10);
  const key = req.body.unit;
  if (!amount || amount < 1 || !units[key]) return res.redirect(`/game/barracks/${v.id}/${req.params.buildingKey}`);
  const result = engine.startTraining(v.id, key, amount);
  if (result.error) {
    return res.redirect(`/game/barracks/${v.id}/${req.params.buildingKey}?error=${encodeURIComponent(result.error)}`);
  }
  res.redirect(`/game/barracks/${v.id}/${req.params.buildingKey}`);
});

module.exports = router;
