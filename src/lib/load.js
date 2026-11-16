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
  const candidates = [];
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

    candidates.push({
      memberId: member.id,
      name: member.name,
      currentLoad: loadPercent(hours, member.availableHours),
      projectedLoad: loadPercent(
        hours + newHours,
        member.availableHours
      )
    });
  }

  candidates.sort((a, b) => {
    return (
      a.projectedLoad - b.projectedLoad ||
      a.currentLoad - b.currentLoad
    );
  });

  return {
    recommendedId: candidates[0]?.memberId ?? null,
    candidates,
    excluded
  };
}