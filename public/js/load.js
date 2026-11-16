// B 박지호 — #load · #recommend (load.html)
// 각 페이지에 자기 자리가 없을 수도 있으니 querySelector 결과가 null 이면 건너뜁니다.
import { api, refresh } from './api.js';

document.addEventListener('data', async (e) => {
  const { members, tasks } = e.detail;
  // TODO: 자기 자리만 다시 그린다
});
