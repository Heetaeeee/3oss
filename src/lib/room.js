import { randomInt } from 'node:crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizeRoomCode(value) {
  if (typeof value !== 'string') return null;

  const code = value.trim().toUpperCase();

  return CODE_PATTERN.test(code) ? code : null;
}

// nextIndex는 테스트에서 코드 충돌을 재현하기 위해 주입할 수 있다.
export function generateRoomCode(existingCodes, nextIndex = randomInt) {
  const taken = new Set(existingCodes);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = '';

    for (let i = 0; i < 6; i += 1) {
      code += CODE_CHARS[nextIndex(CODE_CHARS.length)];
    }

    if (!taken.has(code)) return code;
  }

  throw new Error('방 코드를 생성하지 못했습니다. 다시 시도해 주세요.');
}

export function validateRoomInput(body) {
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return {
      ok: false,
      error: '방 이름과 정원을 입력해 주세요.'
    };
  }

  if (
    typeof body.name !== 'string' ||
    body.name.trim().length < 1 ||
    body.name.trim().length > 50
  ) {
    return {
      ok: false,
      error: '방 이름은 1~50자로 입력해 주세요.'
    };
  }

  if (!Number.isSafeInteger(body.size) || body.size < 1) {
    return {
      ok: false,
      error: '정원은 1 이상의 정수로 입력해 주세요.'
    };
  }

  return {
    ok: true,
    value: {
      name: body.name.trim(),
      size: body.size
    }
  };
}

// 기존 { members, tasks }를 방별 저장 구조로 변환한다.
// 파일 저장과 백업은 store.js가 담당하고, 여기서는 데이터만 변환한다.
export function migrateLegacyData(
  db,
  code,
  createdAt = new Date().toISOString()
) {
    if ( db === null || typeof db !== 'object' || Array.isArray(db) || !Array.isArray(db.members) || !Array.isArray(db.tasks) ) {
    throw new Error('기존 저장 데이터 형식이 올바르지 않습니다.');
    }

    if ( typeof code !== 'string' || normalizeRoomCode(code) === null || normalizeRoomCode(code) !== code ) {
    throw new Error('기본 방 코드가 올바르지 않습니다.');
    }

    return {
        schemaVersion: 1,
        defaultRoom: code,
        rooms: {
            [code]: {
            name: '기존 프로젝트',
            size: Math.max(db.members.length, 1),
            demo: false,
            members: structuredClone(db.members),
            tasks: structuredClone(db.tasks),
            createdAt
            }
        }
    };
}