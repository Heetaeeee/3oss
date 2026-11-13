import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync
} from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dbPath = fileURLToPath(
    new URL('../../data/db.json', import.meta.url)
);

export function load() {
    try {
        const text = readFileSync(dbPath, 'utf8');

        return JSON.parse(text);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return {
                members: [],
                tasks: []
            };
        }

        throw error;
    }
}

export function save(db) {
  mkdirSync(dirname(dbPath), { recursive: true });

  const text = JSON.stringify(db, null, 2);
  const tempPath = `${dbPath}.${randomUUID()}.tmp`;

  try {
    writeFileSync(tempPath, text, {
      encoding: 'utf8',
      flag: 'wx'
    });

    renameSync(tempPath, dbPath);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

export function newId() {
  return randomUUID();
}