import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    synchronize: false,
    logging: process.env.NODE_ENV !== 'production',
    entities: [process.env.NODE_ENV === 'production' ? 'dist/modules/**/*.entity.js' : 'src/modules/**/*.entity.ts'],
    migrations: [process.env.NODE_ENV === 'production' ? 'dist/database/migrations/*.js' : 'src/database/migrations/*.ts'],
});
