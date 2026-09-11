// Vercel function for every Magic Eden route (/api/proxy, /api/magiceden-psbt,
// /api/wallet-tokens, /api/collection-offers-*, ...; vercel.json rewrites them
// here with ?op=<op>). Implementation: server/magiceden.js
module.exports = require('../server/magiceden').handleMagicEden;
