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

export default app;