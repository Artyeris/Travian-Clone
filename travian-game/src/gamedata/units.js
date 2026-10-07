// Unit definitions (Roman troop set + generic). Costs in wood/clay/iron, plus grain upkeep & pop.
// attack/defence = base combat values; speed = units per hour-ish ms per tile base.
const units = {
  legionnaire: {
    key: 'legionnaire', name: 'Legionnaire', type: 'infantry', building: 'barracks',
    cost: { wood: 105, clay: 125, iron: 270 }, pop: 1, grainUpkeep: 0.168,
    attack: 70, defence: 45, speed: 5, // speed: tiles per hour baseline (slower infantry)
    carry: 40, desc: 'Basic Roman infantry.', requires: {},
  },
  pretorian: {
    key: 'pretorian', name: 'Praetorian', type: 'infantry', building: 'barracks',
    cost: { wood: 90, clay: 200, iron: 360 }, pop: 1, grainUpkeep: 0.2,
    attack: 20, defence: 160, speed: 5,
    carry: 50, desc: 'Elite defensive infantry.', requires: { blacksmith: 10 },
  },
  imperian: {
    key: 'imperian', name: 'Imperian', type: 'infantry', building: 'barracks',
    cost: { wood: 120, clay: 100, iron: 250 }, pop: 1, grainUpkeep: 0.15,
    attack: 35, defence: 95, speed: 5,
    carry: 80, desc: 'Balanced infantry with good carrying capacity.', requires: {},
  },
  eques: {
    key: 'eques', name: 'Eques', type: 'cavalry', building: 'stable',
    cost: { wood: 200, clay: 120, iron: 480 }, pop: 2, grainUpkeep: 0.36,
    attack: 155, defence: 70, speed: 12,
    carry: 30, desc: 'Heavy cavalry, strong attack.', requires: { blacksmith: 10 },
  },
  eques_legio: {
    key: 'eques_legio', name: 'Eques Legio', type: 'cavalry', building: 'stable',
    cost: { wood: 240, clay: 140, iron: 560 }, pop: 2, grainUpkeep: 0.42,
    attack: 130, defence: 130, speed: 12,
    carry: 30, desc: 'Balanced heavy cavalry.', requires: { blacksmith: 15 },
  },
  parthian: {
    key: 'parthian', name: 'Parthian Rider', type: 'cavalry', building: 'stable',
    cost: { wood: 240, clay: 140, iron: 560 }, pop: 2, grainUpkeep: 0.42,
    attack: 150, defence: 50, speed: 18,
    carry: 20, desc: 'Fast ranged cavalry.', requires: { blacksmith: 15 },
  },
  chariot: {
    key: 'chariot', name: 'War Chariot', type: 'cavalry', building: 'stable',
    cost: { wood: 260, clay: 210, iron: 490 }, pop: 2, grainUpkeep: 0.4,
    attack: 180, defence: 30, speed: 14,
    carry: 40, desc: 'Fast attacking chariot.', requires: {},
  },
  ram: {
    key: 'ram', name: 'Battering Ram', type: 'siege', building: 'workshop',
    cost: { wood: 370, clay: 200, iron: 430 }, pop: 3, grainUpkeep: 0.6,
    attack: 10, defence: 10, speed: 4, siegeWall: 400,
    carry: 10, desc: 'Reduces city wall level on attack.', requires: { workshop: 5 },
  },
  catapult: {
    key: 'catapult', name: 'Catapult', type: 'siege', building: 'workshop',
    cost: { wood: 250, clay: 370, iron: 430 }, pop: 3, grainUpkeep: 0.6,
    attack: 0, defence: 30, speed: 4, siegeRes: 200,
    carry: 0, desc: 'Destroys resource buildings when attacking.', requires: { workshop: 10 },
  },
  trebuchet: {
    key: 'trebuchet', name: 'Trebuchet', type: 'siege', building: 'workshop',
    cost: { wood: 450, clay: 670, iron: 900 }, pop: 5, grainUpkeep: 1.0,
    attack: 0, defence: 40, speed: 2, siegeRes: 600,
    carry: 0, desc: 'Powerful siege engine that devastates buildings.', requires: { workshop: 15 },
  },
  onager: {
    key: 'onager', name: 'Onager', type: 'siege', building: 'workshop',
    cost: { wood: 400, clay: 600, iron: 800 }, pop: 4, grainUpkeep: 0.8,
    attack: 0, defence: 35, speed: 3, siegeRes: 350,
    carry: 0, desc: 'Medium siege engine.', requires: { workshop: 12 },
  },
  settler: {
    key: 'settler', name: 'Settler', type: 'other', building: 'barracks',
    cost: { wood: 750, clay: 750, iron: 750 }, pop: 1, grainUpkeep: 0.2,
    attack: 0, defence: 50, speed: 5,
    carry: 0, desc: 'Founds new villages. Requires Embassy level 1 and Monument.', requires: { embassy: 1, monument: 1 },
  },
  trader: {
    key: 'trader', name: 'Trader', type: 'other', building: 'market',
    cost: { wood: 200, clay: 150, iron: 300 }, pop: 1, grainUpkeep: 0.15,
    attack: 0, defence: 0, speed: 10,
    carry: 1000, desc: 'Caravans used for trading resources.', requires: {},
  },
};

// Training time per unit in ms at base speed
function getTrainTime(key, speedFactor) {
  const u = units[key];
  const cfgSpeed = speedFactor || require('../config/game').speed.troop;
  let baseSec = 0;
  if (u.type === 'infantry') baseSec = 30 + u.pop * 10;
  else if (u.type === 'cavalry') baseSec = 60 + u.pop * 15;
  else if (u.type === 'siege') baseSec = 120 + u.pop * 20;
  else baseSec = 90;
  return Math.floor((baseSec * 1000) / cfgSpeed);
}

module.exports = { units, getTrainTime };
