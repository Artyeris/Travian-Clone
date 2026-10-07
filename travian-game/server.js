// Application entry point: Express server for the Travian-style browser game
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const { db, init } = require('./src/db');
const mountRoutes = require('./src/routes');
const loop = require('./src/services/loop');
const { SqliteStore } = require('./src/services/sessionStore');

init(); // create tables

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  store: new SqliteStore(),
  secret: process.env.SECRET || 'travian-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
}));
app.use(express.static(path.join(__dirname, 'public')));

// Lightweight flash messages via session
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Global template locals
app.use((req, res, next) => {
  const V = require('./src/models/village');
  res.locals.user = req.session.userId ? require('./src/models/user').getUser(req.session.userId) : null;
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.currentVillages = res.locals.user ? V.getUserVillages(res.locals.user.id) : [];
  res.locals.villagesTotal = db.prepare('SELECT COUNT(*) c FROM villages').get().c;
  if (!res.locals.user && req.path.startsWith('/game')) {
    return res.redirect('/login');
  }
  next();
});

mountRoutes(app);

// Landing page
app.get('/', (req, res) => {
  const stats = {
    players: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    villages: db.prepare('SELECT COUNT(*) c FROM villages').get().c,
  };
  res.render('index', { stats });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Travian server running on http://localhost:${PORT}`);
  loop.start(5000);
});
