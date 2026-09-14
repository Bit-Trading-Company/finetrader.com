// Vercel function for every /api/satflow-* route (vercel.json rewrites them here
// with ?op=<op>). Implementation: server/satflow.js
module.exports = require('../server/satflow').handleSatflow;
