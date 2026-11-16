// 공용 호출 함수 (C 작성). 각자 화면 JS 는 이 두 함수만 가져다 씁니다.

export async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? '요청을 처리하지 못했습니다.');
  return data;
}

// members · tasks 를 받아 'data' 이벤트를 냅니다. 데이터를 바꾼 뒤에는 항상 부릅니다.
export async function refresh() {
  const [members, tasks] = await Promise.all([api('/api/members'), api('/api/tasks')]);
  document.dispatchEvent(new CustomEvent('data', { detail: { members, tasks } }));
}

// 페이지를 열 때 한 번. 각 화면 JS 가 'data' 를 듣기 시작한 뒤에 불러야 해서 HTML 맨 끝에서 부릅니다.
export function start() {
  refresh().catch((error) => {
    document.querySelector('#app-error').textContent = `데이터를 불러오지 못했습니다. ${error.message}`;
  });
}
