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

function validateData(db) {
  if (
    db === null ||
    typeof db !== 'object' ||
    Array.isArray(db) ||
    !Array.isArray(db.members) ||
    !Array.isArray(db.tasks)
  ) {
    throw new Error(
      '저장 데이터 형식이 올바르지 않습니다. members와 tasks는 배열이어야 합니다.'
    );
  }

  return db;
}

export function load() {
    try {
        const text = readFileSync(dbPath, 'utf8');

        return validateData(JSON.parse(text));
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
 const text = JSON.stringify(validateData(db), null, 2);

  mkdirSync(dirname(dbPath), { recursive: true });
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