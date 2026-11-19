// Gemini REST 호출 (SDK 없이 Node 내장 fetch). 어떤 이유로든 실패하면 null — 절대 throw 하지 않는다.
// 형식: https://ai.google.dev/gemini-api/docs (2026-11 확인) — POST /v1beta/models/{model}:generateContent
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'; // 안정판 경량 모델. 바꾸려면 .env 의 GEMINI_MODEL
const TIMEOUT_MS = 8000;

// generationConfig: 응답 형식 지정이 필요할 때만 (예: JSON 배열만 받기)
export async function askLlm(prompt, generationConfig) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null; // 키가 없으면 부르지 않는다 — 화면은 직접 입력으로 넘어간다

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      // 키는 헤더로만 — 주소에 넣으면 로그 · 오류 메시지에 남을 수 있다
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`LLM 호출 실패: HTTP ${res.status} (모델 ${model})`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    if (!text) {
      console.warn(`LLM 응답에 글자가 없음${data?.promptFeedback?.blockReason ? ` (차단: ${data.promptFeedback.blockReason})` : ''}`);
      return null;
    }
    return text;
  } catch (error) {
    // 시간 초과(TimeoutError) · 네트워크 오류 · 응답 JSON 깨짐
    console.warn(`LLM 호출 실패: ${error.name}`);
    return null;
  }
}
