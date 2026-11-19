import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { askLlm } from '../src/lib/llm.js';

// 네트워크 없이 fetch 를 바꿔 끼워 실패 경로를 확인한다
const realFetch = globalThis.fetch;
const realWarn = console.warn;
let calls;
let warnings;

beforeEach(() => {
  calls = [];
  warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  process.env.GEMINI_API_KEY = 'test-key-123';
  delete process.env.GEMINI_MODEL;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  delete process.env.GEMINI_API_KEY;
});

const answer = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const respond = (status, body) => {
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
};

test('키가 없으면 호출하지 않고 null', async () => {
  delete process.env.GEMINI_API_KEY;
  respond(200, answer('["자료 조사"]'));
  assert.equal(await askLlm('작업: 보고서'), null);
  assert.equal(calls.length, 0);
});

test('200 응답이면 생성된 글자를 돌려준다', async () => {
  respond(200, answer('["자료 조사"]'));
  assert.equal(await askLlm('작업: 보고서'), '["자료 조사"]');
});

test('키는 헤더로만 보내고 주소에 넣지 않는다', async () => {
  respond(200, answer('[]'));
  await askLlm('작업: 보고서');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-key-123');
  assert.equal(String(calls[0].url).includes('test-key-123'), false);
});

test('200 이 아닌 응답이면 null 이고 키를 로그에 남기지 않는다', async () => {
  respond(400, { error: { message: 'API key not valid' } });
  assert.equal(await askLlm('작업: 보고서'), null);
  assert.equal(warnings.length, 1);
  assert.equal(warnings.join(' ').includes('test-key-123'), false);
});

test('네트워크 오류 · 시간 초과로 fetch 가 실패해도 throw 하지 않고 null', async () => {
  globalThis.fetch = async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); };
  assert.equal(await askLlm('작업: 보고서'), null);
});

test('응답에 글자가 없으면 (차단 등) null', async () => {
  respond(200, { promptFeedback: { blockReason: 'SAFETY' } });
  assert.equal(await askLlm('작업: 보고서'), null);
});
