import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import { environment } from './config.js';

export type DatabaseClient = Pick<PoolClient, 'query'>;

export class Database {
  readonly pool: Pool;

  constructor(connectionString = environment.DATABASE_URL) {
    if (!connectionString) {
      throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
    }

    this.pool = new Pool({ connectionString });
  }

  query<Row extends QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(text, values);
  }

  async transaction<Result>(work: (client: DatabaseClient) => Promise<Result>): Promise<Result> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}