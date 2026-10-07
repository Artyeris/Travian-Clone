// Research (academy) definitions and hero commands (simplified).
const research = {
  agriculture: { key: 'agriculture', name: 'Agriculture', maxLevel: 10,
    costBase: { wood: 500, clay: 600, iron: 300 }, k: 1.4, timeBase: 3600,
    desc: 'Increases grain production of Granary-related buildings by 10% per level.' },
  mining: { key: 'mining', name: 'Mining', maxLevel: 10,
    costBase: { wood: 400, clay: 500, iron: 200 }, k: 1.4, timeBase: 3000,
    desc: 'Increases iron mine production by 10% per level.' },
  logging: { key: 'logging', name: 'Logging', maxLevel: 10,
    costBase: { wood: 300, clay: 400, iron: 200 }, k: 1.4, timeBase: 2800,
    desc: 'Increases woodcutter production by 10% per level.' },
  brick: { key: 'brick', name: 'Brick Production', maxLevel: 10,
    costBase: { wood: 350, clay: 300, iron: 250 }, k: 1.4, timeBase: 2800,
    desc: 'Increases clay pit production by 10% per level.' },
  siege: { key: 'siege', name: 'Siege Crafts', maxLevel: 10,
    costBase: { wood: 600, clay: 700, iron: 900 }, k: 1.5, timeBase: 5000,
    desc: 'Improves catapult/trebuchet destruction power by 10% per level.' },
  horseback: { key: 'horseback', name: 'Horseback Riding', maxLevel: 5,
    costBase: { wood: 800, clay: 600, iron: 1000 }, k: 1.5, timeBase: 6000,
    desc: 'Increases cavalry attack/defence by 5% per level.' },
  tactics: { key: 'tactics', name: 'Tactics', maxLevel: 5,
    costBase: { wood: 900, clay: 900, iron: 1200 }, k: 1.6, timeBase: 7000,
    desc: 'Increases army speed by 5% per level.' },
  astrology: { key: 'astrology', name: 'Astrology', maxLevel: 1,
    costBase: { wood: 1200, clay: 1200, iron: 1500 }, k: 1.5, timeBase: 10000,
    desc: 'Reveals enemy army composition when attacking.' },
};

function getResearchCost(key, currentLevel) {
  const r = research[key];
  const out = {};
  for (const res of ['wood', 'clay', 'iron']) {
    out[res] = Math.ceil(r.costBase[res] * Math.pow(r.k, currentLevel));
  }
  return out;
}

function getResearchTime(key, currentLevel) {
  const r = research[key];
  const cfg = require('../config/game');
  return Math.floor((r.timeBase * 1000 * Math.pow(1.2, currentLevel)) / cfg.speed.research);
}

module.exports = { research, getResearchCost, getResearchTime };
