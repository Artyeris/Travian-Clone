// Hero routes: view, spend attribute points
const express = require('express');
const router = express.Router();
const V = require('../models/village');
const heroModel = require('../models/hero');

router.get('/:villageId', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  const hero = heroModel.getHero(userId);
  if (!hero) return res.redirect(`/game/village/${v.id}`);
  res.render('game/hero', {
    v, hero, fmt: n => Math.floor(n).toLocaleString(),
    title: 'Hero', nextExp: heroModel.expForLevel(hero.level),
    activeNav: 'hero', currentVillages: V.getUserVillages(userId),
  });
});

router.post('/:villageId/attr', (req, res) => {
  const userId = req.session.userId;
  const v = V.getVillage(Number(req.params.villageId));
  if (!v || v.user_id !== userId) return res.redirect('/game/overview');
  heroModel.spendPoint(userId, req.body.attr);
  res.redirect(`/game/hero/${v.id}`);
});

module.exports = router;
