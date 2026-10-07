// Hero model (simplified Travian hero)
const { db } = require('../db');

function getHero(userId) {
  const h = db.prepare('SELECT * FROM heroes WHERE user_id = ?').get(userId);
  if (!h) return null;
  return {
    ...h,
    attrs: JSON.parse(h.attrs || '{}'),
    skills: JSON.parse(h.skills || '[]'),
    equipment: JSON.parse(h.equipment || '[]'),
  };
}

function createHero(userId, name, villageId) {
  const attrs = { str: 1, int: 1, agi: 1, hp: 30, maxhp: 30 };
  db.prepare(`INSERT INTO heroes (user_id, name, level, exp, points, attrs, skills, village_id, equipment)
              VALUES (?, ?, 1, 0, 0, ?, '[]', ?, '[]')`)
    .run(userId, name, JSON.stringify(attrs), villageId);
  return getHero(userId);
}

// XP curve like classic: exp needed for level n ~ 5*n^2 + 20*n
function expForLevel(level) {
  return Math.floor(5 * level * level + 20 * level);
}

function addExp(userId, amount) {
  const h = getHero(userId);
  if (!h) return;
  let exp = h.exp + amount;
  let level = h.level;
  let points = h.points;
  while (exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level += 1;
    points += 1; // attribute point per level
  }
  db.prepare('UPDATE heroes SET exp = ?, level = ?, points = ? WHERE user_id = ?').run(exp, level, points, userId);
}

function spendPoint(userId, attr) {
  const h = getHero(userId);
  if (!h || h.points <= 0) return false;
  if (!['str', 'int', 'agi'].includes(attr)) return false;
  h.attrs[attr] += 1;
  h.points -= 1;
  db.prepare('UPDATE heroes SET attrs = ?, points = ? WHERE user_id = ?').run(JSON.stringify(h.attrs), h.points, userId);
  return true;
}

function moveHero(userId, villageId) {
  db.prepare('UPDATE heroes SET village_id = ? WHERE user_id = ?').run(villageId, userId);
}

module.exports = { getHero, createHero, addExp, spendPoint, moveHero, expForLevel };
