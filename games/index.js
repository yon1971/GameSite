const list = [
  require('./crazy-eights'),
  require('./rummy'),
  require('./tide-pool'),
  require('./lantern-keepers'),
  require('./bluff-market'),
  require('./rivers'),
  require('./shifting-tower'),
  require('./moth-flame'),
  require('./the-killer'),
  require('./blend-in'),
  require('./tall-tales'),
];
module.exports = Object.fromEntries(list.map((g) => [g.id, g]));
