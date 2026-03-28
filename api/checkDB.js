const { pool } = require('./src/db');
pool.query('SELECT latitude, longitude, COUNT(*) as count FROM public.telegas_pedidos WHERE latitude IS NOT NULL AND latitude != 0 AND longitude != 0 GROUP BY latitude, longitude ORDER BY count DESC LIMIT 15')
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
