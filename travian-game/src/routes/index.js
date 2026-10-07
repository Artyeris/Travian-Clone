// Build all routes and mount them on app
module.exports = function mountRoutes(app) {
  app.use('/', require('./auth'));
  app.use('/game', require('./game'));
  app.use('/game/barracks', require('./barracks'));
  app.use('/game/map', require('./map'));
  app.use('/game/attack', require('./attack'));
  app.use('/game/market', require('./market'));
  app.use('/game/research', require('./research'));
  app.use('/game/hero', require('./hero'));
  app.use('/game/alliance', require('./alliance'));
  app.use('/game/messages', require('./messages'));
  app.use('/game/statistics', require('./statistics'));
};
