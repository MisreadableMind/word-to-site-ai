import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({
  connectionString: config.pluginApi?.databaseUrl || process.env.DATABASE_URL || 'postgresql://localhost:5432/wordtosite',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export default pool;
