// Native (trader) gift definitions - small random resource gifts like classic Travian natives.
const natives = [
  { name: 'Farmer', res: 'grain', min: 20, max: 80 },
  { name: 'Woodcutter', res: 'wood', min: 30, max: 90 },
  { name: 'Clay Digger', res: 'clay', min: 30, max: 90 },
  { name: 'Iron Miner', res: 'iron', min: 20, max: 70 },
];

function randomGift() {
  const n = natives[Math.floor(Math.random() * natives.length)];
  const amount = Math.floor(n.min + Math.random() * (n.max - n.min));
  return { name: n.name, res: n.res, amount };
}

module.exports = { natives, randomGift };
