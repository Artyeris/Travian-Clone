// Alliance routes: create, join, list, kick, diplomacy (war/peace)
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const V = require('../models/village');
const userModel = require('../models/user');

function allianceOf(userId) {
  const row = db.prepare('SELECT a.* FROM alliances a JOIN alliance_members m ON m.alliance_id = a.id WHERE m.user_id = ?').get(userId);
  return row || null;
}

router.get('/', (req, res) => {
  const userId = req.session.userId;
  const my = allianceOf(userId);
  let members = [], requests = [];
  if (my) {
    members = db.prepare(`SELECT u.id, u.username, am.role, am.joined FROM alliance_members am JOIN users u ON u.id = am.user_id WHERE am.alliance_id = ? ORDER BY am.role='leader' DESC, am.joined ASC`).all(my.id);
    requests = db.prepare('SELECT COUNT(*) c FROM messages WHERE to_user IN (SELECT user_id FROM alliance_members WHERE alliance_id = ?)').get(my.id).c;
  }
  const all = db.prepare(`SELECT a.*, (SELECT COUNT(*) FROM alliance_members m WHERE m.alliance_id = a.id) AS members_count,
                          (SELECT SUM(b.level) FROM alliance_members mm JOIN villages v ON v.user_id = mm.user_id JOIN buildings b ON b.village_id = v.id WHERE mm.alliance_id = a.id) AS points
                          FROM alliances a ORDER BY points DESC LIMIT 100`).all();
  res.render('game/alliance', { my, members, all, title: 'Alliance', error: req.query.error || null, activeNav: 'alliance', currentVillages: V.getUserVillages(userId) });
});

router.post('/create', (req, res) => {
  const userId = req.session.userId;
  if (allianceOf(userId)) return res.redirect('/game/alliance');
  const tag = (req.body.tag || '').trim().slice(0, 8);
  const name = (req.body.name || '').trim().slice(0, 30);
  if (!tag || !name) return res.redirect('/game/alliance?error=Need+tag+and+name');
  const info = db.prepare('INSERT INTO alliances (tag, name, leader, created_at) VALUES (?, ?, ?, ?)').run(tag, name, userId, Date.now());
  db.prepare('INSERT INTO alliance_members (alliance_id, user_id, role, joined) VALUES (?, ?, ?, ?)').run(info.lastInsertRowid, userId, 'leader', Date.now());
  res.redirect('/game/alliance');
});

router.post('/join', (req, res) => {
  const userId = req.session.userId;
  if (allianceOf(userId)) return res.redirect('/game/alliance');
  const id = parseInt(req.body.alliance_id, 10);
  const a = db.prepare('SELECT * FROM alliances WHERE id = ?').get(id);
  if (!a) return res.redirect('/game/alliance?error=Alliance not found');
  db.prepare('INSERT OR IGNORE INTO alliance_members (alliance_id, user_id, role, joined) VALUES (?, ?, ?, ?)').run(id, userId, 'member', Date.now());
  res.redirect('/game/alliance');
});

router.post('/leave', (req, res) => {
  const userId = req.session.userId;
  const my = allianceOf(userId);
  if (!my) return res.redirect('/game/alliance');
  if (my.leader === userId) {
    // transfer or disband
    const others = db.prepare('SELECT user_id FROM alliance_members WHERE alliance_id = ? AND user_id != ?').all(my.id, userId);
    if (others.length) {
      db.prepare('UPDATE alliance_members SET role = ? WHERE alliance_id = ? AND user_id = ?').run('leader', my.id, others[0].user_id);
      db.prepare('UPDATE alliances SET leader = ? WHERE id = ?').run(others[0].user_id, my.id);
    } else {
      db.prepare('DELETE FROM alliances WHERE id = ?').run(my.id);
      return res.redirect('/game/alliance');
    }
  }
  db.prepare('DELETE FROM alliance_members WHERE alliance_id = ? AND user_id = ?').run(my.id, userId);
  res.redirect('/game/alliance');
});

module.exports = router;
module.exports.allianceOf = allianceOf;
