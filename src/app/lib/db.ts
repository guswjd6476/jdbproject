import { Pool } from 'pg';

/* eslint-disable no-var */
declare global {
    var pgPool: Pool | undefined;
}
/* eslint-enable no-var */

const pool =
    global.pgPool ??
    new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

if (!global.pgPool) {
    global.pgPool = pool;
}

export { pool };
