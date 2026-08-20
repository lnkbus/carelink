import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, type QueryResultRow } from 'pg';

/**
 * PostgreSQL 접근. 모듈의 repository/ 에서만 주입받는다.
 *
 * 모듈 경계 규칙(docs/02 §4): 다른 모듈의 테이블을 직접 SELECT 하지 않는다.
 * matching이 candidates를 읽어야 하면 talent 서비스를 호출한다.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.get<string>('DATABASE_URL'),
      max: Number(config.get('PG_POOL_MAX') ?? 10),
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query<T>(sql, params);
    return res.rows;
  }

  async one<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /**
   * 트랜잭션. 상태 전이 + audit_logs 적재처럼 함께 커밋돼야 하는 작업에 쓴다.
   * 감사 로그가 따로 커밋되면 "조회는 됐는데 기록은 없는" 상태가 생긴다.
   */
  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
