// Attack / reinforce / settle routes
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const V = require('../models/village');
const M = require('../models/map');
const engine = require('../services/engine');
const { units } = require('../gamedata/units');
const cfg = require('../config/game');

router.get('/:villageId', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const troops = engine.getUnits(v.id);
  const targetX = parseInt(req.query.x, 10);
  const targetY = parseInt(req.query.y, 10);
  let target = null;
  if (!isNaN(targetX) && !isNaN(targetY)) target = V.getVillageByCoord(targetX, targetY);
  // movements in flight from this village
  const moving = db.prepare("SELECT * FROM movements WHERE from_village = ? AND status = 'outbound'").all(v.id);
  const { buildings: defs } = require('../gamedata/buildings');
  res.render('game/attack', {
    v, troops, target, units, fmt: n => Math.floor(n).toLocaleString(), moving,
    title: 'Attack', defByName: defs, sent: req.query.sent ? 1 : null, error: req.query.error || null,
    coord: (targetX >= 0 && targetY >= 0) ? { x: targetX, y: targetY } : null,
    activeNav: 'attack', currentVillages: V.getUserVillages(userId),
  });
});

router.post('/:villageId/send', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');

  const type = req.body.type; // attack | reinforce | settle | spy
  const x = parseInt(req.body.x, 10);
  const y = parseInt(req.body.y, 10);
  if (isNaN(x) || isNaN(y)) return res.redirect(`/game/attack/${v.id}?error=Invalid+coordinates`);

  // gather requested units
  const send = {};
  for (const k of Object.keys(units)) {
    const val = parseInt(req.body['unit_' + k], 10);
    if (val > 0) send[k] = val;
  }
  if (!Object.keys(send).length) return res.redirect(`/game/attack/${v.id}?error=No+units+selected`);

  // validate available
  const have = engine.getUnits(v.id);
  for (const [k, c] of Object.entries(send)) {
    if ((have[k] || 0) < c) return res.redirect(`/game/attack/${v.id}?error=Not+enough+${units[k].name}`);
  }

  let targetVillage = V.getVillageByCoord(x, y);

  if (type === 'settle') {
    if (!(send.settler >= 1)) return res.redirect(`/game/attack/${v.id}?error=Need+at+least+1+Settler`);
    if (V.buildingLevel(v.id, 'embassy') < 1 || V.buildingLevel(v.id, 'monument') < 1)
      return res.redirect(`/game/attack/${v.id}?error=Need+Embassy+and+Monument`);
    if (targetVillage) return res.redirect(`/game/attack/${v.id}?error=Spot+occupied`);
    // create an empty barbarian placeholder at coords so movement has a destination row
    const info = db.prepare(`INSERT INTO villages (user_id, name, x, y, is_capital, wood, clay, iron, grain, population, created_at)
                              VALUES (NULL, 'Barbarian Camp', ?, ?, 0, 0,0,0,0,0, ?)`).run(x, y, Date.now());
    targetVillage = V.getVillage(info.lastInsertRowid);
  } else if (!targetVillage) {
    return res.redirect(`/game/attack/${v.id}?error=No+village+at+that+coord`);
  }

  // friendly check for reinforce/settle to own/allied villages
  const heroFlag = req.body.hero ? 1 : 0;

  const minSpeed = (() => {
    let sp = Infinity;
    for (const k of Object.keys(send)) sp = Math.min(sp, units[k].speed);
    return sp;
  })();
  // Tactics research speeds up armies by 5% per level
  const tRow = db.prepare("SELECT level FROM player_research WHERE user_id = ? AND key = 'tactics'").get(userId);
  const speedFactor = cfg.speed.unitSpeed * (1 + (tRow ? tRow.level : 0) * 0.05);
  const tt = M.travelTime(v.x, v.y, targetVillage.x, targetVillage.y, minSpeed, speedFactor);

  engine.removeUnits(v.id, send);
  db.prepare(`INSERT INTO movements (user_id, type, from_village, to_village, arrive_time, units, hero, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'outbound')`)
    .run(userId, type, v.id, targetVillage.id, Date.now() + tt, JSON.stringify(send), heroFlag);

  res.redirect(`/game/attack/${v.id}?sent=1`);
});

module.exports = router;
