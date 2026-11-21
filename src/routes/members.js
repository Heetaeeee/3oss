import { Router } from 'express';
import { load, save, newId } from '../lib/store.js';
import { validateMember } from '../lib/validate.js';
import { revealAfterMemberRemoved } from '../lib/estimate.js';

// 테스트는 메모리 데이터를 넘긴다 (tasks.js · recommend.js 와 같은 방식)
export function createMembersRouter(loadDb = load, saveDb = save) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(loadDb().members);
  });

  router.post('/', (req, res) => {
    const db = loadDb();
    const v = validateMember(req.body, { takenNames: db.members.map((m) => m.name) });
    if (!v.ok) return res.status(400).json({ error: v.error });
    const member = { id: newId(), ...v.value };
    db.members.push(member);
    saveDb(db);
    res.status(201).json(member);
  });

  router.patch('/:id', (req, res) => {
    const db = loadDb();
    const member = db.members.find((m) => m.id === req.params.id);
    if (!member) return res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    const takenNames = db.members.filter((m) => m.id !== member.id).map((m) => m.name);
    const v = validateMember(req.body, { partial: true, takenNames });
    if (!v.ok) return res.status(400).json({ error: v.error });
    Object.assign(member, v.value);
    saveDb(db);
    res.json(member);
  });

  // 팀원 삭제 (STATUS 5장 "정한 것 5") — 맡은 작업은 담당 미정, 낸 추정은 남기되 계산에서 빠짐,
  // 삭제로 "남은 전원이 냄" 이 채워진 작업은 A 의 함수로 그 자리에서 공개 기록을 남긴다
  // shortcut: 정원 1 감소는 입장 코드(방) 저장 구조가 들어온 뒤 2단계에 붙인다
  router.delete('/:id', (req, res) => {
    const db = loadDb();
    if (!db.members.some((m) => m.id === req.params.id)) return res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    db.members = db.members.filter((m) => m.id !== req.params.id);
    const ids = db.members.map((m) => m.id);
    const now = new Date().toISOString();
    const unassigned = [];
    for (const t of db.tasks) {
      if (t.assigneeId === req.params.id) { t.assigneeId = null; unassigned.push(t.id); }
      Object.assign(t, revealAfterMemberRemoved(t, ids, now));
    }
    saveDb(db);
    res.json({ deleted: req.params.id, unassigned });
  });

  return router;
}

export default createMembersRouter();
