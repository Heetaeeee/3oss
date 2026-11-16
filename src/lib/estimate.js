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
