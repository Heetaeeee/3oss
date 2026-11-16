import express from 'express';

import membersRouter from './routes/members.js';
import tasksRouter from './routes/tasks.js';
import recommendRouter from './routes/recommend.js';
import loadsRouter from './routes/loads.js';
import progressRouter from './routes/progress.js';
import estimatesRouter from './routes/estimates.js';
import breakdownRouter from './routes/breakdown.js';

const app = express();

app.use(express.json({ limit: '10kb'}));
app.use(express.static('public'));

app.use('/api/members', membersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/progress', progressRouter);
app.use('/api/recommend', recommendRouter);
app.use('/api/loads', loadsRouter);
app.use('/api', estimatesRouter);
app.use('/api/breakdown', breakdownRouter);

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