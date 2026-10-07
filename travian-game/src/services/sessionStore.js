// Session store backed by our SQLite db (avoids extra dependency)
const { db } = require('../db');
const util = require('util');
const session = require('express-session');

class SqliteStore extends session.Store {
  get(sid, cb) {
    const row = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?').get(sid, Date.now());
    if (!row) return cb(null, null);
    try { return cb(null, JSON.parse(row.sess)); } catch (e) { return cb(e); }
  }
  set(sid, sess, cb) {
    const exp = Date.now() + (sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 86400000);
    db.prepare('INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired')
      .run(sid, JSON.stringify(sess), exp);
    if (cb) cb(null);
  }
  destroy(sid, cb) {
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    if (cb) cb(null);
  }
  touch(sid, sess, cb) {
    const exp = Date.now() + (sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 86400000);
    db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?').run(exp, sid);
    if (cb) cb(null);
  }
}

module.exports = { SqliteStore };
