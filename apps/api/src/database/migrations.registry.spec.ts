import { readdirSync } from 'fs';
import { join } from 'path';
import { ALL_MIGRATIONS } from './migrations';

/**
 * Guards the contract documented in migrations/index.ts: every migration
 * file in src/database/migrations must be registered in ALL_MIGRATIONS.
 * Before the registry existed, app.module.ts hand-listed 55 of 78 files
 * and the other 23 silently never ran at boot.
 */
describe('migration registry completeness', () => {
  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir).filter((f) => /^\d+-.+\.ts$/.test(f));

  it('finds migration files on disk', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('registers every migration file in ALL_MIGRATIONS', () => {
    const registered = new Set(ALL_MIGRATIONS.map((m) => m.name));
    const missing: string[] = [];

    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(join(dir, file)) as Record<string, unknown>;
      const classes = Object.values(mod).filter(
        (v): v is new () => unknown => typeof v === 'function',
      );
      expect(classes.length).toBeGreaterThan(0);
      for (const cls of classes) {
        if (!registered.has(cls.name)) {
          missing.push(`${file} -> ${cls.name}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('contains no duplicate registrations', () => {
    const names = ALL_MIGRATIONS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('registers nothing that lacks a file on disk', () => {
    const onDisk = new Set<string>();
    for (const file of files) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(join(dir, file)) as Record<string, unknown>;
      for (const v of Object.values(mod)) {
        if (typeof v === 'function') onDisk.add(v.name);
      }
    }
    const orphans = ALL_MIGRATIONS.map((m) => m.name).filter(
      (n) => !onDisk.has(n),
    );
    expect(orphans).toEqual([]);
  });
});
