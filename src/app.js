import express from 'express';

import { createRoomContext } from './middleware/room-context.js';
import membersRouter from './routes/members.js';
import tasksRouter from './routes/tasks.js';
import recommendRouter from './routes/recommend.js';
import loadsRouter from './routes/loads.js';
import progressRouter from './routes/progress.js';
import estimatesRouter from './routes/estimates.js';
import breakdownRouter from './routes/breakdown.js';
import weeklyRouter from './routes/weekly.js';
import roomsRouter from './routes/rooms.js';

const app = express();

app.use(express.json({ limit: '10kb'}));
app.use(express.static('public'));

// 입장 전에도 화면에서 확인할 수 있는 공개 설정이다.
app.get('/api/config', (req, res) => {
  res.json({
    roomsEnabled: process.env.ROOMS_ENABLED === '1'
  });
});

app.use('/api/rooms', roomsRouter);

// 설정 조회와 방 입장 관련 경로 다음에 검사한다.
app.use('/api', createRoomContext());

app.use('/api/members', membersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/progress', progressRouter);
app.use('/api/recommend', recommendRouter);
app.use('/api/loads', loadsRouter);
app.use('/api', estimatesRouter);
app.use('/api/breakdown', breakdownRouter);
app.use('/api/weekly', weeklyRouter);

app.use((req, res) => {
  res.status(404).json({
    error: '요청한 경로를 찾을 수 없습니다.'
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: '요청 본문의 JSON 형식을 확인해 주세요.'
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: '요청 본문은 10KB 이하로 보내 주세요.'
    });
  }

  console.error(error);

  res.status(500).json({
    error: '서버에서 요청을 처리하지 못했습니다.'
  });
});

export default app;