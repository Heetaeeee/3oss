// estimates: { 팀원 id: { hours, reason } }
// 전원이 내기 전에는 values · reasons · median 을 담지 않는다
// wasRevealed: 이미 한 번 공개된 작업이면 새 팀원이 들어와도 공개를 유지한다
export function estimateSummary(estimates, memberIds, wasRevealed = false) {
  const submittedIds = memberIds.filter((id) => estimates[id]);
  const revealed = submittedIds.length > 0 &&
    (wasRevealed || submittedIds.length === memberIds.length);
  if (!revealed) return { revealed, submittedIds };

  const values = {};
  const reasons = {};
  for (const id of submittedIds) {
    values[id] = estimates[id].hours;
    if (estimates[id].reason) reasons[id] = estimates[id].reason;
  }

  const sorted = Object.values(values).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const wideSpread = sorted.at(-1) >= sorted[0] * 2;

  return { revealed, submittedIds, values, reasons, median, wideSpread };
}

// 공개된 뒤의 값을 버전으로 쌓는다. 앞 버전은 지우지 않아 의견이 조율되는 과정이 남는다.
// by: 이 버전을 만든 팀원 id. 처음 공개(전원 제출)면 null
export function addVersion(history, summary, by, at) {
  if (!summary.revealed) return history;
  const { values, reasons, median } = summary;
  // 같은 값을 다시 낸 것은 조율이 아니므로 쌓지 않는다
  const last = history.at(-1);
  if (last && JSON.stringify([last.values, last.reasons]) === JSON.stringify([values, reasons])) return history;
  return [...history, { version: history.length + 1, by, at, values, reasons, median }];
}

// 팀원이 빠진 뒤 작업의 공개 상태를 다시 본다. C 의 DELETE /api/members/:id 가 남은 팀원 id 로 작업마다 부른다.
// 추정은 제출할 때만 공개를 기록하므로, 삭제로 "남은 전원이 냄" 이 채워지면 여기서 공개 기록과 ver 1 을 남긴다.
// 그러지 않으면 화면엔 공개돼 보여도 기록이 없어, 다음에 팀원이 늘면 다시 가려지고 수정 기록에 ver 1 이 빠진다.
// 삭제된 팀원이 낸 추정은 지우지 않는다 — memberIds 에 없으니 계산에서만 빠진다.
// → 작업에 그대로 덮어쓸 { estimatesRevealed, estimateHistory }. 원본 작업은 바꾸지 않는다
export function revealAfterMemberRemoved(task, memberIds, at) {
  const estimatesRevealed = Boolean(task.estimatesRevealed);
  const estimateHistory = task.estimateHistory ?? [];
  if (estimatesRevealed) return { estimatesRevealed, estimateHistory };
  const summary = estimateSummary(task.estimates ?? {}, memberIds);
  if (!summary.revealed) return { estimatesRevealed, estimateHistory };
  return { estimatesRevealed: true, estimateHistory: addVersion(estimateHistory, summary, null, at) };
}
