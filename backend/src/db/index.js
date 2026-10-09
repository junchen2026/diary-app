import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'riji',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

/** Get a pooled client */
async function getClient() {
  const client = await pool.connect();
  return { client, release: () => client.release() };
}

/** Execute a query with automatic client management and retry */
async function withClient(fn) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { client, release } = await getClient();
    try {
      const result = await fn(client);
      release();
      return result;
    } catch (err) {
      release();
      // Retry on connection errors
      if (attempt === 0 && (
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === '57P01' ||  // admin_shutdown
        err.code === '57P03' ||  // cannot_connect_now
        err.code === '08006' ||  // connection_failure
        err.code === '08001' ||  // sqlclient_unable_to_establish_sqlconnection
        err.message?.includes('Connection terminated') ||
        err.message?.includes('timeout')
      )) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Convert ? placeholders to $1, $2, ... for PostgreSQL
function convertSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Mimic better-sqlite3 prepared statement API (async)
function prepare(sql) {
  const pgSql = convertSql(sql);
  return {
    async all(...params) {
      return withClient(async (client) => {
        const { rows } = await client.query(pgSql, params);
        return rows;
      });
    },
    async get(...params) {
      return withClient(async (client) => {
        const { rows } = await client.query(pgSql, params);
        return rows[0] || null;
      });
    },
    async run(...params) {
      return withClient(async (client) => {
        const result = await client.query(pgSql, params);
        return {
          changes: result.rowCount,
          lastInsertRowid: result.rows[0]?.id ?? null,
        };
      });
    },
  };
}

// Mimic db.exec() — runs raw SQL (no params)
async function exec(sql) {
  return withClient(async (client) => {
    await client.query(sql);
  });
}

// Direct query access
async function query(sql, params = []) {
  const pgSql = convertSql(sql);
  return withClient(async (client) => {
    const { rows } = await client.query(pgSql, params);
    return rows;
  });
}

export default { get pool() { return pool; }, prepare, exec, query, convertSql };
