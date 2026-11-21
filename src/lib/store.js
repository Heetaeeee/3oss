import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync,
  copyFileSync,
  constants
} from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  generateRoomCode,
  normalizeRoomCode,
  validateRoomInput,
  migrateLegacyData
} from './room.js';

const dataDir = process.env.DATA_DIR ||
  fileURLToPath(new URL('../../data', import.meta.url));

const dbPath = join(dataDir, 'db.json');

function isObject(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function validateData(db) {
  if (
    !isObject(db) ||
    !Array.isArray(db.members) ||
    !Array.isArray(db.tasks)
  ) {
    throw new Error(
      '저장 데이터 형식이 올바르지 않습니다. members와 tasks는 배열이어야 합니다.'
    );
  }

  return db;
}

function validateStore(db) {
  if (
    !isObject(db) ||
    db.schemaVersion !== 1 ||
    !isObject(db.rooms) ||
    typeof db.defaultRoom !== 'string' ||
    !Object.hasOwn(db.rooms, db.defaultRoom)
  ) {
    throw new Error('방 저장 데이터 형식이 올바르지 않습니다.');
  }

  for (const [code, room] of Object.entries(db.rooms)) {
    if (normalizeRoomCode(code) !== code) {
      throw new Error('저장된 방 코드가 올바르지 않습니다.');
    }

    validateData(room);

    const input = validateRoomInput(room);

    if (
      !input.ok ||
      typeof room.demo !== 'boolean' ||
      typeof room.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(room.createdAt))
    ) {
      throw new Error('저장된 방 정보가 올바르지 않습니다.');
    }
  }

  return db;
}

// 테스트에서는 별도 임시 파일 경로를 넘겨 실제 데이터를 보호한다.
export function createStore(filePath) {
  function writeAtomic(db) {
    const text = JSON.stringify(validateStore(db), null, 2);

    mkdirSync(dirname(filePath), { recursive: true });

    const tempPath = `${filePath}.${randomUUID()}.tmp`;

    try {
      writeFileSync(tempPath, text, {
        encoding: 'utf8',
        flag: 'wx'
      });

      renameSync(tempPath, filePath);
    } finally {
      rmSync(tempPath, { force: true });
    }
  }

  function readStore() {
    let text;

    try {
      text = readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;

      const initial = migrateLegacyData(
        { members: [], tasks: [] },
        generateRoomCode([])
      );

      writeAtomic(initial);
      return initial;
    }

    const parsed = JSON.parse(text);

    // 새 구조가 표시된 파일이 잘못됐으면 오류를 낸다.
    // 기존 데이터로 오인해서 덮어쓰지 않는다.
    if (
      isObject(parsed) &&
      (
        Object.hasOwn(parsed, 'schemaVersion') ||
        Object.hasOwn(parsed, 'rooms') ||
        Object.hasOwn(parsed, 'defaultRoom')
      )
    ) {
      return validateStore(parsed);
    }

    validateData(parsed);

    const migrated = migrateLegacyData(
      parsed,
      generateRoomCode([])
    );

    validateStore(migrated);

    // 기존 파일을 보존한 다음에만 새 구조를 저장한다.
    const backupPath =
      `${filePath}.before-rooms-${randomUUID()}.bak`;

    copyFileSync(filePath, backupPath, constants.COPYFILE_EXCL);
    writeAtomic(migrated);

    return migrated;
  }

  function loadRoom(code) {
    const normalized = normalizeRoomCode(code);
    if (normalized === null) return null;

    const db = readStore();

    return Object.hasOwn(db.rooms, normalized)
      ? db.rooms[normalized]
      : null;
  }

  function saveRoom(code, room) {
    validateData(room);

    const normalized = normalizeRoomCode(code);
    const db = readStore();

    if (
      normalized === null ||
      !Object.hasOwn(db.rooms, normalized)
    ) {
      throw new Error('저장할 방을 찾을 수 없습니다.');
    }

    // members·tasks만 받아도 기존 방의 팀명·정원 등은 유지한다.
    db.rooms[normalized] = {
      ...db.rooms[normalized],
      ...room
    };

    writeAtomic(db);
  }

  function createRoom(input) {
    const result = validateRoomInput(input);

    if (!result.ok) {
      throw new Error(result.error);
    }

    const db = readStore();
    const code = generateRoomCode(Object.keys(db.rooms));

    const room = {
      ...result.value,
      demo: false,
      members: [],
      tasks: [],
      createdAt: new Date().toISOString()
    };

    db.rooms[code] = room;
    writeAtomic(db);

    return { code, ...room };
  }

  // 기존 라우터 호환용. 기본 방만 읽고 씀
  function load() {
    const db = readStore();
    const room = db.rooms[db.defaultRoom];

    return {
      members: room.members,
      tasks: room.tasks
    };
  }

  function save(data) {
    validateData(data);

    const db = readStore();

    db.rooms[db.defaultRoom] = {
      ...db.rooms[db.defaultRoom],
      members: data.members,
      tasks: data.tasks
    };

    writeAtomic(db);
  }

  function getDefaultRoomCode() {
    return readStore().defaultRoom;
  }

  return {
    load,
    save,
    loadRoom,
    saveRoom,
    createRoom,
    getDefaultRoomCode
  };
}

const defaultStore = createStore(dbPath);

export const load = defaultStore.load;
export const save = defaultStore.save;
export const loadRoom = defaultStore.loadRoom;
export const saveRoom = defaultStore.saveRoom;
export const createRoom = defaultStore.createRoom;
export const getDefaultRoomCode = defaultStore.getDefaultRoomCode;

export function newId() {
  return randomUUID();
}