import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// 환경 변수가 없거나 비어 있으면 기존 data/ 폴더를 사용한다.
const dataDir = process.env.DATA_DIR ||
  fileURLToPath(new URL('../../data', import.meta.url));

const dbPath = join(dataDir, 'db.json');

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