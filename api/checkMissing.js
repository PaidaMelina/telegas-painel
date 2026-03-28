const { pool } = require('./src/db');
pool.query('SELECT COUNT(*) as count FROM public.telegas_pedidos WHERE latitude IS NULL')
  .then(res => { console.log("Missing:", res.rows[0].count); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
