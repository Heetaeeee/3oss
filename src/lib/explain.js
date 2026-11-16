export function explainRecommendation(result) {
  const { recommendedId, candidates, excluded } = result;

  if (candidates.length === 0) {
    return '배정할 수 있는 팀원이 없습니다. 가능한 시간을 먼저 입력해 주세요.';
  }

  const recommended = candidates.find(
    (candidate) => candidate.memberId === recommendedId
  );

  let text;

  if (candidates.length === 1) {
    text =
      `${recommended.name} 님만 배정할 수 있습니다. ` +
      `맡으면 부담률이 ${recommended.currentLoad}% → ` +
      `${recommended.projectedLoad}%가 됩니다.`;
  } else {
    const next = candidates.find(
      (candidate) => candidate.memberId !== recommendedId
    );

    text =
      `${recommended.name} 님이 맡으면 부담률이 ` +
      `${recommended.currentLoad}% → ` +
      `${recommended.projectedLoad}%로 가장 낮습니다. ` +
      `다음은 ${next.name} 님` +
      `(${next.currentLoad}% → ${next.projectedLoad}%)입니다.`;
  }

  if (recommended.projectedLoad > 100) {
    text +=
      ' 누가 맡아도 100%를 넘으니 ' +
      '작업을 나누거나 일정을 조정해 보세요.';
  }

  for (const member of excluded) {
    text +=
      ` ${member.name} 님은 가능한 시간이 0이라 제외했습니다.`;
  }

  return text;
}