import {
  getDefaultRoomCode,
  loadRoom
} from '../lib/store.js';

import { normalizeRoomCode } from '../lib/room.js';

export function createRoomContext({
  store = { getDefaultRoomCode, loadRoom },
  enabled = () => process.env.ROOMS_ENABLED === '1'
} = {}) {
  return (req, res, next) => {
    // 전환 기간에는 헤더와 관계없이 기존 기본 방을 사용한다.
    if (!enabled()) {
      req.roomCode = store.getDefaultRoomCode();
      return next();
    }

    const code = normalizeRoomCode(req.get('X-Room-Code'));

    if (code === null) {
      return res.status(400).json({
        error: '올바른 방 코드를 함께 보내 주세요.'
      });
    }

    if (!store.loadRoom(code)) {
      return res.status(404).json({
        error: '방을 찾을 수 없습니다.'
      });
    }

    req.roomCode = code;

    return next();
  };
}