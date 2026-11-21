import { Router } from 'express';
import { validateMember } from '../lib/validate.js';

import {
  createRoom,
  loadRoom,
  saveRoom,
  newId
} from '../lib/store.js';

import {
  normalizeRoomCode,
  validateRoomInput
} from '../lib/room.js';

import {
  revealAfterMemberRemoved
} from '../lib/estimate.js';

// 테스트에서 임시 저장소와 스위치를 주입할 수 있다.
export function createRoomsRouter({
  store = { createRoom, loadRoom, saveRoom },
  enabled = () => process.env.ROOMS_ENABLED === '1'
} = {}) {
  const router = Router();

  // 준비 중인 API가 실제 서비스에서 사용되지 않도록 차단한다.
  router.use((req, res, next) => {
    if (!enabled()) {
      return res.status(404).json({
        error: '요청한 경로를 찾을 수 없습니다.'
      });
    }

    next();
  });

  router.post('/', (req, res) => {
    const result = validateRoomInput(req.body);

    if (!result.ok) {
      return res.status(400).json({
        error: result.error
      });
    }

    const room = store.createRoom(result.value);

    return res.status(201).json({
      code: room.code,
      name: room.name,
      size: room.size
    });
  });

  router.get('/:code', (req, res) => {
    const code = normalizeRoomCode(req.params.code);

    if (code === null) {
      return res.status(400).json({
        error: '방 코드는 영문과 숫자 6자리로 입력해 주세요.'
      });
    }

    const room = store.loadRoom(code);

    if (!room) {
      return res.status(404).json({
        error: '방을 찾을 수 없습니다.'
      });
    }

    // 입장 확인에 필요한 정보만 반환한다.
    return res.json({
      code,
      name: room.name,
      size: room.size,
      memberCount: room.members.length
    });
  });

  router.post('/:code/join', (req, res) => {
    const code = normalizeRoomCode(req.params.code);

    if (code === null) {
      return res.status(400).json({
        error: '방 코드는 영문과 숫자 6자리로 입력해 주세요.'
      });
    }

    const room = store.loadRoom(code);

    if (!room) {
      return res.status(404).json({
        error: '방을 찾을 수 없습니다.'
      });
    }

    const body = req.body;

    if (
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        error: '입장할 이름을 입력해 주세요.'
      });
    }

    // 이름만 입력받는다. 가능한 시간과 ID는 서버가 정한다.
    const result = validateMember({
      name: body.name,
      availableHours: 0
    }, {
      takenNames: room.members.map((member) => member.name)
    });

    if (!result.ok) {
      return res.status(400).json({
        error: result.error
      });
    }

    if (room.members.length >= room.size) {
      return res.status(400).json({
        error: '팀원 수가 다 찼습니다.'
      });
    }

    const member = {
      id: newId(),
      ...result.value
    };

    room.members.push(member);
    store.saveRoom(code, room);

    return res.status(201).json(member);
  });

    router.patch('/:code', (req, res) => {
    const code = normalizeRoomCode(req.params.code);
    const headerCode = normalizeRoomCode(
      req.get('X-Room-Code')
    );

    if (code === null) {
      return res.status(400).json({
        error: '방 코드는 영문과 숫자 6자리로 입력해 주세요.'
      });
    }

    if (headerCode === null || headerCode !== code) {
      return res.status(400).json({
        error: '변경할 방의 코드를 확인해 주세요.'
      });
    }

    const room = store.loadRoom(code);

    if (!room) {
      return res.status(404).json({
        error: '방을 찾을 수 없습니다.'
      });
    }

    const body = req.body;

    if (
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !Number.isSafeInteger(body.size) ||
      body.size < 1
    ) {
      return res.status(400).json({
        error: '정원은 1 이상의 정수로 입력해 주세요.'
      });
    }

    if (body.size < room.members.length) {
      return res.status(400).json({
        error: '정원은 현재 등록된 팀원 수보다 작을 수 없습니다.'
      });
    }

    room.size = body.size;

    // 정원을 채운 상태에서만 최초 공개 조건을 다시 검사한다.
    if (room.members.length === room.size) {
      const memberIds = room.members.map((member) => member.id);
      const at = new Date().toISOString();

      room.tasks = room.tasks.map((task) => ({
        ...task,
        ...revealAfterMemberRemoved(task, memberIds, at)
      }));
    }

    store.saveRoom(code, room);

    return res.json({
      code,
      name: room.name,
      size: room.size,
      memberCount: room.members.length
    });
  });

  return router;
}

export default createRoomsRouter();