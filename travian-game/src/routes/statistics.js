// Statistics / leaderboard
const express = require('express');
const router = express.Router();
const userModel = require('../models/user');
const V = require('../models/village');

router.get('/', (req, res) => {
  const players = userModel.getLeaderboard(100);
  res.render('game/statistics', { players, title: 'Statistics', activeNav: 'stats', currentVillages: req.session.userId ? V.getUserVillages(req.session.userId) : [] });
});

module.exports = router;
