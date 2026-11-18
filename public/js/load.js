import { api, refresh } from './api.js';

const loadSlot = document.querySelector('#load');

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);

  return node;
}

function drawLoads(data, members) {
  if (!loadSlot) return;

  const title = el('h2', {}, '부담률');

  if (data.members.length === 0) {
    loadSlot.replaceChildren(
      title,
      el('p', { className: 'sub' }, '팀원을 먼저 등록하세요.')
    );
    return;
  }

  const meters = data.members.map((member) => {
    const index = members.findIndex(
      (item) => item.id === member.memberId
    );
    const colorNumber = (Math.max(index, 0) % 6) + 1;

    const avatarClass = colorNumber === 1
      ? 'avatar'
      : `avatar avatar--${colorNumber}`;

    const who = el(
      'span',
      { className: 'who' },
      el(
        'span',
        { className: avatarClass, ariaHidden: 'true' },
        member.name.slice(0, 1)
      ),
      member.name
    );

    const value = member.load === null
      ? '배정 불가'
      : `${member.load}%${member.overloaded ? ' 과부하' : ''}`;

    const valueClass = member.load === null
      ? 'sub'
      : member.overloaded ? 'over' : '';

    const bar = el('div', {
      className: 'bar',
      role: 'img',
      ariaLabel: `${member.name} 부담률 ${value}`
    });

    if (member.load !== null) {
      const fill = el('span', { className: 'bar-now' });
      fill.style.setProperty('--v', String(member.load));
      bar.append(fill);
    }

    const meter = el(
      'div',
      { className: 'meter' },
      el(
        'div',
        { className: 'between' },
        who,
        el('strong', { className: valueClass }, value)
      ),
      bar
    );

    if (member.load === null) {
      meter.append(
        el(
        'p',
        { className: 'sub' },
        `맡은 미완료 작업 ${member.currentHours}시간 / ` +
        `가능한 시간 ${member.availableHours}시간`
        )
      );
    }

    return meter;
  });

  loadSlot.replaceChildren(
    title,
    ...meters,
    el(
      'p',
      { className: 'sub' },
      '세로선이 가능한 시간의 100%입니다. 넘으면 과부하로 표시합니다.'
    )
  );
}

let loadRequest = 0;

document.addEventListener('data', async (event) => {
  if (!loadSlot) return;

  const request = ++loadRequest;
  const { members } = event.detail;

  try {
    const data = await api('/api/loads');

    // 이전 요청이 늦게 도착해 최신 화면을 덮지 않도록 합니다.
    if (request !== loadRequest) return;

    drawLoads(data, members);
  } catch (error) {
    if (request !== loadRequest) return;

    loadSlot.replaceChildren(
      el('h2', {}, '부담률'),
      el(
        'p',
        { className: 'msg-error', role: 'alert' },
        error.message
      )
    );
  }
});
const recommendSlot = document.querySelector('#recommend');

function drawRecommendations(tasks, members) {
  if (!recommendSlot) return;

  const title = el('h2', {}, '담당자 추천');

  const pending = tasks.filter((task) =>
    task.status !== 'DONE' &&
    task.hours != null &&
    task.assigneeId == null
  );

  if (pending.length === 0) {
  const unfinished = tasks.filter(
    (task) => task.status !== 'DONE'
  );

  const needsEstimate = unfinished.some(
    (task) =>
      task.assigneeId == null &&
      task.hours == null
  );

  let message;
  let linkText;
  let href;

  if (tasks.length === 0) {
    message = '아직 작업이 없습니다. 작업을 먼저 등록해 주세요.';
    linkText = '등록 · 진행으로 이동';
    href = 'board.html';
  } else if (unfinished.length === 0) {
    message = '모든 작업이 완료됐습니다.';
    linkText = '진행 현황 확인';
    href = 'board.html';
  } else if (needsEstimate) {
    message =
      '담당자가 정해지지 않은 작업의 크기가 미확정입니다. ' +
      '작업 정의 화면에서 크기를 먼저 확정해 주세요.';
    linkText = '작업 정의로 이동';
    href = 'sizing.html';
  } else {
    message = '모든 미완료 작업에 담당자가 배정돼 있습니다.';
    linkText = '배정 현황 확인';
    href = 'board.html';
  }

  recommendSlot.replaceChildren(
    title,
    el('p', { className: 'sub' }, message),
    el('a', { href }, linkText)
  );

  return;
}

  const cards = pending.map((task) => {
    const resultBox = el('div', { className: 'slot stack' });
    const errorBox = el('p', {
      className: 'msg-error',
      role: 'alert'
    });

    const recommendButton = el(
      'button',
      { className: 'btn', type: 'button' },
      '담당자 추천'
    );

    const parent = tasks.find(
      (item) => item.id === task.parentId
    );

    const badges = el('div', { className: 'badges' });

    const days = taskDaysLeft(task.dueDate);

    if (days !== null) {
      badges.append(
        el(
          'span',
          {
            className: days < 0
              ? 'badge badge--over'
              : 'badge'
          },
          days < 0
            ? `지남 ${-days}일`
            : days === 0 ? 'D-day' : `D-${days}`
        )
      );
    }

    badges.append(
      el(
        'span',
        { className: 'badge badge--team' },
        `${task.hours}시간 확정`
      ),
      el(
        'span',
        { className: 'badge badge--todo' },
        '담당 미정'
      )
    );

    const card = el(
      'article',
      { className: 'card stack' },
      el('h3', {}, task.title)
    );

    if (parent) {
      card.append(
        el(
          'p',
          { className: 'sub' },
          `↳ ${parent.title}의 세부 작업`
        )
      );
    }

    card.append(
      badges,
      recommendButton,
      errorBox,
      resultBox
    );

    recommendButton.addEventListener('click', async () => {
      recommendButton.disabled = true;
      recommendButton.textContent = '추천 계산 중…';
      errorBox.textContent = '';
      resultBox.replaceChildren();

      try {
        const result = await api('/api/recommend', {
          method: 'POST',
          body: { taskId: task.id }
        });

        if (!card.isConnected) return;

        drawCandidates(resultBox, task, result, members);
      } catch (error) {
        errorBox.textContent = error.message;
      } finally {
        recommendButton.disabled = false;
        recommendButton.textContent = '담당자 추천';
      }
    });

    return card;
  });

  recommendSlot.replaceChildren(title, ...cards);
}

function taskDaysLeft(dueDate) {
  if (!dueDate) return null;

  const now = new Date();

  const today = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const [year, month, day] = dueDate.split('-').map(Number);
  const deadline = Date.UTC(year, month - 1, day);

  return Math.round((deadline - today) / 86_400_000);
}

function memberChip(memberId, name, members) {
  const index = members.findIndex(
    (member) => member.id === memberId
  );

  const colorNumber = (Math.max(index, 0) % 6) + 1;

  const avatarClass = colorNumber === 1
    ? 'avatar'
    : `avatar avatar--${colorNumber}`;

  return el(
    'span',
    { className: 'who' },
    el(
      'span',
      { className: avatarClass, ariaHidden: 'true' },
      name.slice(0, 1)
    ),
    name
  );
}

function drawCandidates(slot, task, result, members) {
  const explanation = el('p', {}, result.explanation);
  const candidateList = el('div', { className: 'stack' });
  const errorBox = el('p', {
    className: 'msg-error',
    role: 'alert'
  });

  const assignButtons = [];

  for (const candidate of result.candidates) {
    const recommended = candidate.memberId === result.recommendedId;

    const name = memberChip(
  candidate.memberId,
  candidate.name,
  members
);

    if (recommended) {
      name.append(
        ' ',
        el('span', { className: 'badge badge--primary' }, '추천')
      );
    }

    const value = el(
      'strong',
      {
        className: candidate.projectedLoad > 100 ? 'over' : ''
      },
      `${candidate.currentLoad}% → ${candidate.projectedLoad}%` +
      (candidate.projectedLoad > 100 ? ' 과부하' : '')
    );

    const bar = el('div', {
      className: 'bar',
      role: 'img',
      ariaLabel:
        `${candidate.name}: 이 작업 제외 시 ` +
        `${candidate.currentLoad}%, 배정 후 ` +
        `${candidate.projectedLoad}%`
    });

    const next = el('span', { className: 'bar-next' });
    next.style.setProperty('--v', String(candidate.projectedLoad));

    const now = el('span', { className: 'bar-now' });
    now.style.setProperty('--v', String(candidate.currentLoad));

    bar.append(next, now);

    const meter = el(
      'div',
      { className: 'meter' },
      el('div', { className: 'between' }, name, value),
      bar
    );

    const button = el(
      'button',
      {
        className: recommended
          ? 'btn btn--primary btn--s'
          : 'btn btn--s',
        type: 'button'
      },
      '배정'
    );

    assignButtons.push(button);

    button.addEventListener('click', async () => {
      assignButtons.forEach((item) => {
        item.disabled = true;
      });

      button.textContent = '배정 중…';
      errorBox.textContent = '';

      let assigned = false;

      try {
        await api(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          body: { assigneeId: candidate.memberId }
        });

        assigned = true;
        await refresh();
      } catch (error) {
        errorBox.textContent = assigned
          ? `배정은 저장됐지만 화면을 갱신하지 못했습니다. 새로고침해 주세요. ${error.message}`
          : error.message;
      } finally {
        assignButtons.forEach((item) => {
          item.disabled = false;
        });

        button.textContent = '배정';
      }
    });

    candidateList.append(
      el('div', { className: 'pick' }, meter, button)
    );
  }

  const excluded = result.excluded.map((member) =>
    el(
      'p',
      { className: 'sub' },
      `제외: ${member.name} (가능한 시간 0시간)`
    )
  );

  slot.replaceChildren(
    el('h3', {}, '담당자 추천'),
    explanation,
    el(
      'p',
      { className: 'sub' },
      '막대: 채움은 이 작업 제외 시, 빗금은 배정 후 예상 부담률입니다.'
    ),
    candidateList,
    ...excluded,
    errorBox,
    el(
      'p',
      { className: 'sub' },
      '추천은 참고 자료입니다. 담당자는 팀이 정합니다.'
    )
  );
}

document.addEventListener('data', (event) => {
  const { members, tasks } = event.detail;

  drawRecommendations(tasks, members);
});