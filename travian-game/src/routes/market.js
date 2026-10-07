// Market: trade routes between villages + offer list
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const V = require('../models/village');
const M = require('../models/map');
const engine = require('../services/engine');
const cfg = require('../config/game');

router.get('/:villageId', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  if (V.buildingLevel(v.id, 'market') < 1) return res.redirect(`/game/village/${v.id}?error=Requires+Marketplace`);
  const offers = db.prepare(`SELECT m.*, u.username FROM market_offers m JOIN users u ON u.id = m.user_id ORDER BY m.created_at DESC LIMIT 30`).all();
  const traders = engine.getUnits(v.id).trader || 0;
  const { buildings: defs } = require('../gamedata/buildings');
  res.render('game/market', {
    v, offers, traders, fmt: n => Math.floor(n).toLocaleString(), title: 'Marketplace',
    defByName: defs, error: req.query.error || null, sent: req.query.sent ? 1 : null,
    activeNav: 'market', currentVillages: V.getUserVillages(userId),
  });
});

// Create a trade route to coordinates
router.post('/:villageId/route', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const x = parseInt(req.body.x, 10), y = parseInt(req.body.y, 10);
  const giveRes = req.body.give_res, getRes = req.body.get_res;
  const amount = parseInt(req.body.amount, 10);
  const numTraders = parseInt(req.body.traders, 10) || 0;
  const ratio = parseFloat(req.body.ratio) || 1;
  if (!['wood','clay','iron'].includes(giveRes) || !['wood','clay','iron'].includes(getRes) || giveRes === getRes)
    return res.redirect(`/game/market/${v.id}?error=Invalid+resources`);
  const target = V.getVillageByCoord(x, y);
  if (!target) return res.redirect(`/game/market/${v.id}?error=No+village+at+coord`);
  if (numTraders < 1) return res.redirect(`/game/market/${v.id}?error=Need+traders`);
  const haveTraders = engine.getUnits(v.id).trader || 0;
  if (haveTraders < numTraders) return res.redirect(`/game/market/${v.id}?error=Not+enough+traders`);
  const carryPer = units_traderCarry() * numTraders;
  const totalGive = Math.min(amount, carryPer);
  if (v[giveRes] < totalGive) return res.redirect(`/game/market/${v.id}?error=Not+enough+${giveRes}`);

  // deduct & send
  db.prepare(`UPDATE villages SET ${giveRes} = ${giveRes} - ? WHERE id = ?`).run(totalGive, v.id);
  engine.removeUnits(v.id, { trader: numTraders });
  const recv = {};
  recv[getRes] = Math.floor(totalGive / ratio);
  const tt = M.travelTime(v.x, v.y, target.x, target.y, 10, cfg.speed.unitSpeed);
  db.prepare(`INSERT INTO movements (user_id, type, from_village, to_village, arrive_time, resources, status)
              VALUES (?, 'trade', ?, ?, ?, ?, 'outbound')`)
    .run(userId, v.id, target.id, Date.now() + tt, JSON.stringify(recv));
  // return trip with empty traders
  db.prepare(`INSERT INTO movements (user_id, type, from_village, to_village, arrive_time, units, status)
              VALUES (?, 'return', ?, ?, ?, ?, 'outbound')`)
    .run(userId, target.id, v.id, Date.now() + tt * 2, JSON.stringify({ trader: numTraders }));
  res.redirect(`/game/market/${v.id}?sent=1`);
});

function units_traderCarry() {
  return require('../gamedata/units').units.trader.carry;
}

module.exports = router;
