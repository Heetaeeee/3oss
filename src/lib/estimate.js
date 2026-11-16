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
