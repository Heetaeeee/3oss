import { Router } from 'express';

import { askLlm } from '../lib/llm.js';
import { parseSubtasks } from '../lib/breakdown.js';

const router = Router();

// LLM 에는 작업 제목만 보낸다. 팀원 이름 · 시간 · 다른 작업은 보내지 않는다.
// 숫자(시간 · 담당 · 날짜)는 AI 를 거치지 않도록 제목만 달라고 하고, 돌아온 것도 parseSubtasks 로 다시 거른다.
const prompt = (title) => `너는 대학생 팀 프로젝트의 작업을 나누는 도우미다.
아래 작업을 3~6개의 세부 작업으로 나눠라.
- 세부 작업의 제목만 쓴다. 각 제목은 20자 이내의 명사형.
- 예상 시간, 담당자, 날짜, 설명은 쓰지 않는다.
- JSON 문자열 배열만 출력한다. 다른 말은 쓰지 않는다.

작업: ${title}`;

// 응답을 문자열 배열로 받도록 형식을 지정한다 (그래도 parseSubtasks 가 마지막 검사를 한다)
const asTitleArray = {
  responseMimeType: 'application/json',
  responseJsonSchema: { type: 'array', items: { type: 'string' } },
};

// POST /api/breakdown { title } — 제안만 돌려주고 저장하지 않는다. LLM 이 실패해도 500 대신 fallback
router.post('/', async (req, res) => {
  const title = req.body?.title;
  if (typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 100) {
    return res.status(400).json({ error: '작업 제목을 입력해 주세요.' });
  }

  const raw = await askLlm(prompt(title.trim()), asTitleArray);
  const subtasks = parseSubtasks(raw, title.trim());
  res.json({ subtasks, source: subtasks.length ? 'ai' : 'fallback' });
});

export default router;
