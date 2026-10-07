// Building definitions (Roman/travian-style). Cost formula: base * k^(level-1)
const buildings = {
  main: {
    key: 'main', name: 'Main Building', type: 'res', resident: true,
    costBase: { wood: 140, clay: 200, iron: 60 }, k: 1.28,
    desc: 'The heart of your village. Upgrading increases warehouse capacity and unlocks more building slots.',
    maxLevel: 20,
    gives: { storage: lvl => Math.floor(800 + 400 * Math.pow(lvl, 1.35)) },
  },
  warehouse: {
    key: 'warehouse', name: 'Warehouse', type: 'store', resident: false,
    costBase: { wood: 90, clay: 130, iron: 70 }, k: 1.25,
    desc: 'Stores wood, clay and iron. Higher levels increase capacity and slow down raiders.',
    maxLevel: 20,
    gives: { storage: lvl => Math.floor(600 + 300 * Math.pow(lvl, 1.4)) },
  },
  granary: {
    key: 'granary', name: 'Granary', type: 'store', resident: false,
    costBase: { wood: 110, clay: 110, iron: 70 }, k: 1.25,
    desc: 'Stores grain which feeds your population and enables growth.',
    maxLevel: 20,
    gives: { grainStorage: lvl => Math.floor(500 + 250 * Math.pow(lvl, 1.4)) },
  },
  blacksmith: {
    key: 'blacksmith', name: 'Blacksmith', type: 'military', resident: false,
    costBase: { wood: 130, clay: 220, iron: 110 }, k: 1.27,
    desc: 'Produces weapons for your troops. Required to train most units.',
    maxLevel: 20,
  },
  market: {
    key: 'market', name: 'Marketplace', type: 'other', resident: false,
    costBase: { wood: 120, clay: 160, iron: 90 }, k: 1.26,
    desc: 'Trade resources with other players via caravans.',
    maxLevel: 20,
  },
  barracks: {
    key: 'barracks', name: 'Barracks', type: 'military', resident: false,
    costBase: { wood: 210, clay: 240, iron: 140 }, k: 1.28,
    desc: 'Trains infantry units such as Legionnaires and Praetorians.',
    maxLevel: 20,
  },
  stable: {
    key: 'stable', name: 'Stable', type: 'military', resident: false,
    costBase: { wood: 220, clay: 200, iron: 130 }, k: 1.28,
    desc: 'Trains cavalry units like Equites and Parthian Riders.',
    maxLevel: 20,
  },
  workshop: {
    key: 'workshop', name: 'Workshop', type: 'military', resident: false,
    costBase: { wood: 320, clay: 360, iron: 210 }, k: 1.29,
    desc: 'Builds siege engines: Ram, Catapult, Trebuchet and Onager.',
    maxLevel: 20,
  },
  embassy: {
    key: 'embassy', name: 'Embassy', type: 'other', resident: false,
    costBase: { wood: 200, clay: 250, iron: 120 }, k: 1.27,
    desc: 'Enables alliances, hero management and sending troops to allies.',
    maxLevel: 3,
  },
  treasury: {
    key: 'treasury', name: 'Treasury', type: 'other', resident: false,
    costBase: { wood: 200, clay: 200, iron: 200 }, k: 1.30,
    desc: 'Where the Hero resides and researches abilities.',
    maxLevel: 10,
  },
  monument: {
    key: 'monument', name: 'Monument', type: 'other', resident: false,
    costBase: { wood: 200, clay: 200, iron: 200 }, k: 1.30,
    desc: 'Boosts loyalty of your villagers and grants culture points.',
    maxLevel: 20,
  },
  wall: {
    key: 'wall', name: 'City Wall', type: 'defense', resident: false,
    costBase: { wood: 100, clay: 170, iron: 90 }, k: 1.25,
    desc: 'Protects your village. Each level adds a defence bonus to defending troops.',
    maxLevel: 20,
  },
  residence: {
    key: 'residence', name: 'Residence', type: 'res', resident: true,
    costBase: { wood: 140, clay: 190, iron: 80 }, k: 1.28,
    desc: 'Provides housing for your growing population.',
    maxLevel: 20,
    gives: { housing: lvl => Math.floor(10 + 6 * lvl + 0.6 * lvl * lvl) },
  },
  council: {
    key: 'council', name: 'Council House', type: 'res', resident: false,
    costBase: { wood: 160, clay: 210, iron: 90 }, k: 1.28,
    desc: 'Required to build additional resource fields and upgrades beyond level 9.',
    maxLevel: 10,
    requires: { main: 10 },
  },
  academy: {
    key: 'academy', name: 'Academy', type: 'research', resident: false,
    costBase: { wood: 220, clay: 220, iron: 150 }, k: 1.29,
    desc: 'Researches technologies that strengthen your empire.',
    maxLevel: 10,
    requires: { main: 10 },
  },
  theater: {
    key: 'theater', name: 'Theater', type: 'culture', resident: false,
    costBase: { wood: 180, clay: 180, iron: 100 }, k: 1.27,
    desc: 'Generates cultural points used by some upgrades.',
    maxLevel: 20,
  },

  // Resource fields
  woodcutter: {
    key: 'woodcutter', name: 'Woodcutter\'s Hut', type: 'res', resident: true,
    costBase: { wood: 40, clay: 100, iron: 50 }, k: 1.28,
    desc: 'Produces wood.', maxLevel: 18,
    production: { wood: lvl => Math.floor(6 + 4 * lvl + 0.35 * lvl * lvl) },
  },
  claypit: {
    key: 'claypit', name: 'Clay Pit', type: 'res', resident: true,
    costBase: { wood: 80, clay: 40, iron: 50 }, k: 1.28,
    desc: 'Produces clay.', maxLevel: 18,
    production: { clay: lvl => Math.floor(6 + 4 * lvl + 0.35 * lvl * lvl) },
  },
  ironmine: {
    key: 'ironmine', name: 'Iron Mine', type: 'res', resident: true,
    costBase: { wood: 90, clay: 90, iron: 30 }, k: 1.28,
    desc: 'Produces iron.', maxLevel: 18,
    production: { iron: lvl => Math.floor(6 + 4 * lvl + 0.35 * lvl * lvl) },
  },
  grainfield: {
    key: 'grainfield', name: 'Grain Field', type: 'res', resident: true,
    costBase: { wood: 70, clay: 70, iron: 70 }, k: 1.28,
    desc: 'Produces grain for the population.', maxLevel: 18,
    production: { grain: lvl => Math.floor(6 + 4 * lvl + 0.35 * lvl * lvl) },
  },
  herbivore: {
    key: 'herbivore', name: 'Herbivore Farm', type: 'res', resident: true,
    costBase: { wood: 60, clay: 60, iron: 60 }, k: 1.28,
    desc: 'Produces extra grain.', maxLevel: 10,
    production: { grain: lvl => Math.floor(3 + 3 * lvl + 0.2 * lvl * lvl) },
  },
};

// Compute upgrade cost from level -> level+1
function getCost(key, currentLevel) {
  const b = buildings[key];
  if (!b) return null;
  const out = {};
  for (const res of ['wood', 'clay', 'iron']) {
    out[res] = Math.ceil(b.costBase[res] * Math.pow(b.k, currentLevel));
  }
  return out;
}

// Build time in ms for going from level L to L+1 (classic-like curve)
function getBuildTime(key, currentLevel, speedFactor) {
  const b = buildings[key];
  const lvl = currentLevel + 1;
  let baseSec;
  if (b.type === 'res' || b.type === 'store') {
    baseSec = 30 + 25 * Math.pow(lvl, 1.5);
  } else if (b.type === 'military' || b.type === 'defense') {
    baseSec = 40 + 35 * Math.pow(lvl, 1.5);
  } else {
    baseSec = 50 + 45 * Math.pow(lvl, 1.5);
  }
  return Math.floor((baseSec * 1000) / (speedFactor || configSpeed()));
}

function configSpeed() { return require('../config/game').speed.build; }

module.exports = { buildings, getCost, getBuildTime };
