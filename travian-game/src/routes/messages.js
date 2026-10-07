// In-game messaging between players
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const V = require('../models/village');

router.get('/', (req, res) => {
  const userId = req.session.userId;
  const inbox = db.prepare(`SELECT m.*, u.username AS from_name FROM messages m LEFT JOIN users u ON u.id = m.from_user WHERE m.to_user = ? ORDER BY m.time DESC LIMIT 50`).all(userId);
  const outbox = db.prepare(`SELECT m.*, u.username AS to_name FROM messages m JOIN users u ON u.id = m.to_user WHERE m.from_user = ? ORDER BY m.time DESC LIMIT 50`).all(userId);
  res.render('game/messages', { inbox, outbox, title: 'Messages', error: req.query.error || null, activeNav: 'messages', currentVillages: V.getUserVillages(userId) });
});

router.post('/send', (req, res) => {
  const userId = req.session.userId;
  const toName = (req.body.to || '').trim();
  const subject = (req.body.subject || '').slice(0, 80);
  const body = (req.body.body || '').slice(0, 2000);
  const target = require('../models/user').getUserByName(toName);
  if (!target || !body) return res.redirect('/game/messages?error=Invalid+recipient');
  db.prepare('INSERT INTO messages (from_user, to_user, subject, body, time) VALUES (?, ?, ?, ?, ?)').run(userId, target.id, subject, body, Date.now());
  res.redirect('/game/messages');
});

router.post('/read/:id', (req, res) => {
  db.prepare('UPDATE messages SET read = 1 WHERE id = ? AND to_user = ?').run(Number(req.params.id), req.session.userId);
  res.redirect('/game/messages');
});

module.exports = router;
