// Academy research routes
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const V = require('../models/village');
const engine = require('../services/engine');
const { research, getResearchCost, getResearchTime } = require('../gamedata/research');

router.get('/:villageId', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const academyLvl = V.buildingLevel(v.id, 'academy');
  const owned = {};
  for (const r of db.prepare('SELECT key, level FROM player_research WHERE user_id = ?').all(userId)) owned[r.key] = r.level;
  const queue = db.prepare('SELECT * FROM research_queue WHERE village_id = ?').get(v.id);
  const { buildings: defs } = require('../gamedata/buildings');
  res.render('game/research', {
    v, academyLvl, research, owned, queue, title: 'Academy', defByName: defs, error: req.query.error || null,
    cost: k => getResearchCost(k, owned[k] || 0),
    time: k => getResearchTime(k, owned[k] || 0),
    fmt: n => Math.floor(n).toLocaleString(),
    activeNav: 'research', currentVillages: V.getUserVillages(userId),
  });
});

router.post('/:villageId/start', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const result = engine.startResearch(userId, v.id, req.body.key);
  if (result.error) return res.redirect(`/game/research/${v.id}?error=${encodeURIComponent(result.error)}`);
  res.redirect(`/game/research/${v.id}`);
});

module.exports = router;
