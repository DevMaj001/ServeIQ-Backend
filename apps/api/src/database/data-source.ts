import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { ALL_MIGRATIONS } from './migrations';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  entities: [
    process.env.NODE_ENV === 'production'
      ? 'dist/modules/**/*.entity.js'
      : 'src/modules/**/*.entity.ts',
  ],
  // Shared with app.module.ts so the CLI and boot-time migrationsRun can
  // never diverge (they previously did: 23 files were CLI-only).
  migrations: ALL_MIGRATIONS,
  extra: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});
