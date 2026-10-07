// Global game configuration and speed factors
const config = {
  // World map dimensions (classic Travian style)
  mapWidth: 400,
  mapHeight: 400,

  // Starting resources / storage base capacity
  startResources: { wood: 750, clay: 1000, iron: 750 },
  startPopulation: 2,
  grainStart: 0,

  // Population growth: new inhabitant every N ms when granary has enough grain
  popIntervalBase: 3600000 / 12, // base ~5 min per person at speed 1 => we use 20 min classic; keep playable
  popGrainNeedBase: 240,        // grain needed in granary for one new person (base)

  // Trader (native) interval base
  traderIntervalBase: 3600000 / 2, // ~30 min at speed 1

  speed: {
    resource: 1,     // resource production speed factor
    build: 1,        // construction speed factor
    research: 1,
    troop: 1,
    unitSpeed: 1,    // army movement speed factor
    grain: 1,        // grain consumption factor
    population: 1,   // population growth factor
  },

  // Attack/defence constants
  wallBonusBase: 0.15,       // +15% defence per wall level (pre-cap)
  wallCapLevel: 20,
  heroExpPerResource: 1,     // XP per resource carried back

  // NPC / barbarian village density: chance a nearby empty slot is a barbarian
  barbarianNearbyChance: 0.35,
};

module.exports = config;
