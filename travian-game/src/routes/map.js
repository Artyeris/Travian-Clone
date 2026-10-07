// World map routes (canvas-rendered on client; this provides tile data)
const express = require('express');
const router = express.Router();
const V = require('../models/village');
const M = require('../models/map');
const cfg = require('../config/game');

router.get('/:villageId', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  res.render('game/map', { v, title: 'World map', activeNav: 'map', currentVillages: V.getUserVillages(userId), mapW: cfg.mapWidth, mapH: cfg.mapHeight });
});

// Tile data endpoint for the canvas map viewer
router.get('/data/:villageId', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.status(403).json({ error: 'forbidden' });
  let x0 = parseInt(req.query.x, 10);
  let y0 = parseInt(req.query.y, 10);
  const w = Math.min(50, parseInt(req.query.w, 10) || 30);
  const h = Math.min(50, parseInt(req.query.h, 10) || 30);
  if (isNaN(x0)) x0 = Math.max(0, v.x - Math.floor(w / 2));
  if (isNaN(y0)) y0 = Math.max(0, v.y - Math.floor(h / 2));
  const villages = M.getVillagesInBounds(x0, y0, x0 + w - 1, y0 + h - 1);
  // enrich with owner names & points
  const users = {};
  for (const row of villages) {
    if (row.user_id && !users[row.user_id]) {
      const u = require('../models/user').getUser(row.user_id);
      users[row.user_id] = u ? u.username : null;
    }
    row.ownerName = row.user_id ? users[row.user_id] : 'Barbarians';
    row.points = require('../models/user').villageScore(row.id);
  }
  res.json({ x0, y0, w, h, villages });
});

module.exports = router;
