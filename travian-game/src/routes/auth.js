// Auth routes: register, login, logout
const express = require('express');
const router = express.Router();
const userModel = require('../models/user');
const V = require('../models/village');
const M = require('../models/map');
const heroModel = require('../models/hero');

router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const u = userModel.verifyUser(username, password);
  if (!u) return res.render('auth/login', { error: 'Invalid username or password.' });
  req.session.userId = u.id;
  res.redirect('/game');
});

router.get('/register', (req, res) => {
  res.render('auth/register', { error: null });
});

router.post('/register', (req, res) => {
  let { username, password, password2, tribe, villageName } = req.body;
  if (!username || !password) return res.render('auth/register', { error: 'All fields required.' });
  username = String(username).trim();
  if (username.length < 3 || username.length > 16) return res.render('auth/register', { error: 'Username must be 3-16 characters.' });
  if (userModel.getUserByName(username)) return res.render('auth/register', { error: 'Username already taken.' });
  if (password !== password2) return res.render('auth/register', { error: 'Passwords do not match.' });
  if (!['roman', 'teuton', 'gallic'].includes(tribe)) tribe = 'roman';

  const u = userModel.createUser(username, password, tribe);
  // place capital at random spot
  const existing = [];
  const spot = M.findPlace(existing);
  const name = (villageName && villageName.trim()) ? villageName.trim().slice(0, 20) : `${username}'s Capital`;
  const v = V.createVillage(u.id, name, spot.x, spot.y, { capital: true });
  db_setTrader(v.id);
  heroModel.createHero(u.id, username, v.id);
  req.session.userId = u.id;
  res.redirect('/game');
});

function db_setTrader(vid) {
  const cfg = require('../config/game');
  require('../db').db.prepare('UPDATE villages SET trader_interval = ? WHERE id = ?')
    .run(Date.now() + cfg.traderIntervalBase + Math.random() * cfg.traderIntervalBase, vid);
}

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
