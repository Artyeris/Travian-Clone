// User & auth model
const bcrypt = require('bcryptjs');
const { db } = require('../db');

const now = () => Date.now();

function createUser(username, password, tribe) {
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, password, tribe, created_at) VALUES (?, ?, ?, ?)')
    .run(username, hash, tribe || 'roman', now());
  return getUser(info.lastInsertRowid);
}

function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByName(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function verifyUser(username, password) {
  const u = getUserByName(username);
  if (!u || u.banned) return null;
  if (!bcrypt.compareSync(password, u.password)) return null;
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now(), u.id);
  return u;
}

function totalPoints(userId) {
  // sum of building levels across villages as simple score
  const rows = db.prepare(`SELECT b.level FROM buildings b JOIN villages v ON v.id = b.village_id WHERE v.user_id = ?`).all(userId);
  return rows.reduce((s, r) => s + r.level, 0);
}

function villageScore(villageId) {
  const rows = db.prepare('SELECT level FROM buildings WHERE village_id = ?').all(villageId);
  return rows.reduce((s, r) => s + r.level, 0);
}

function getLeaderboard(limit = 50) {
  const users = db.prepare('SELECT id, username, tribe FROM users WHERE banned = 0 ORDER BY id ASC').all();
  const scored = users.map(u => ({ ...u, points: totalPoints(u.id) }))
    .filter(u => u.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
  return scored;
}

module.exports = { createUser, getUser, getUserByName, verifyUser, totalPoints, villageScore, getLeaderboard };
