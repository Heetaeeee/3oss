import app from './src/app.js';
import { load } from './src/lib/store.js';

load();

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
    console.log(`서버 실행 중: http://localhost:${port}`);
});