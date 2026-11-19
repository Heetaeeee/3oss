export function currentHours(memberId, tasks) {
  return tasks
    .filter((task) =>
      task.assigneeId === memberId &&
      task.status !== 'DONE' &&
      typeof task.hours === 'number'
    )
    .reduce((total, task) => total + task.hours, 0);
}

export function loadPercent(hours, availableHours) {
  if (availableHours <= 0) {
    return null;
  }

  return Math.round((hours / availableHours) * 100);
}

export function recommend(members, tasks, newHours) {
  const ranked = [];
  const excluded = [];

  for (const member of members) {
    if (member.availableHours <= 0) {
      excluded.push({
        memberId: member.id,
        name: member.name,
        reason: 'NO_AVAILABLE_TIME'
      });

      continue;
    }

    const hours = currentHours(member.id, tasks);

    ranked.push({
      memberId: member.id,
      name: member.name,
      currentRatio: hours / member.availableHours,
      projectedRatio: (hours + newHours) / member.availableHours
    });
  }

  // 순위는 반올림 전 비율로 정한다.
  // 두 비율이 모두 같으면 안정 정렬에 따라 등록 순서를 유지한다.
  ranked.sort((a, b) =>
    a.projectedRatio - b.projectedRatio ||
    a.currentRatio - b.currentRatio
  );

  // 화면과 기존 API 응답에는 정수 퍼센트만 전달한다.
  const candidates = ranked.map((member) => ({
    memberId: member.memberId,
    name: member.name,
    currentLoad: Math.round(member.currentRatio * 100),
    projectedLoad: Math.round(member.projectedRatio * 100)
  }));

  return {
    recommendedId: candidates[0]?.memberId ?? null,
    candidates,
    excluded
  };
}