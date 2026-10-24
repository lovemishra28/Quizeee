const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GoogleGenAI } = require('@google/genai');
const { loadSource } = require('./helpers/load-typescript.cjs');

const question = { question_text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correct_option_index: 1, explanation: 'Two pairs make four.', subtopic: 'Arithmetic' };
const fixtureKey = 'fixture-gemini-placeholder';
const pdf = Buffer.from('%PDF-1.4\nsynthetic SDK transport fixture');

function contentResponse(text, extra = {}) {
    return Response.json({
        candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
        ...extra,
    });
}

/** Use the installed SDK's real serialization/response/retry code with only fetch replaced. */
function fixture(response = () => contentResponse(JSON.stringify([question])), env = {}) {
    const requests = [], clients = [], logs = [];
    class LocalTransportClient extends GoogleGenAI {
        constructor(options) {
            clients.push({ enterprise: options.enterprise, timeout: options.httpOptions.timeout, attempts: options.httpOptions.retryOptions.attempts });
            super({
                ...options,
                httpOptions: {
                    ...options.httpOptions,
                    fetch: async (input, init) => {
                        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
                        const headers = new Headers(init?.headers);
                        const request = {
                            path: url.pathname,
                            method: init?.method,
                            body: JSON.parse(init?.body || '{}'),
                            authenticated: headers.get('x-goog-api-key') === fixtureKey,
                            keyInUrl: url.searchParams.has('key'),
                            hasAbortSignal: Boolean(init?.signal),
                        };
                        requests.push(request);
                        return response(request, requests.length);
                    },
                },
            });
        }
    }
    const adapter = loadSource('src/lib/ai/gemini.ts', {
        env: { GEMINI_API_KEY: fixtureKey, GEMINI_MODEL: 'fixture-model', ...env },
        logs,
        overrides: { '@google/genai': { GoogleGenAI: LocalTransportClient } },
    });
    return { adapter, requests, clients, logs };
}

test('Gemini text adapter uses the supported SDK JSON contract and actual response.text', async () => {
    const transport = fixture();
    const questions = await transport.adapter.generateQuizWithGemini('Synthetic arithmetic notes.', 1);
    assert.equal(questions[0].correct_option_index, 1);
    assert.equal(transport.requests.length, 1);
    assert.equal(transport.requests[0].method, 'POST');
    assert.match(transport.requests[0].path, /models\/fixture-model:generateContent$/);
    assert.equal(transport.requests[0].body.generationConfig.responseMimeType, 'application/json');
    assert.match(transport.requests[0].body.contents[0].parts[0].text, /Synthetic arithmetic notes/);
});

test('Gemini PDF quiz preserves inline PDF bytes, prompt and JSON output request', async () => {
    const transport = fixture();
    const questions = await transport.adapter.generateQuizFromPdfBufferWithGemini(pdf, 1);
    assert.equal(questions.length, 1);
    const body = transport.requests[0].body;
    assert.equal(body.contents[0].role, 'user');
    assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'application/pdf');
    assert.equal(body.contents[0].parts[0].inlineData.data, pdf.toString('base64'));
    assert.match(body.contents[0].parts[1].text, /exactly 1/);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
});

test('Gemini OCR preserves plain study notes rather than treating them as question JSON', async () => {
    const notes = 'Synthetic slide transcription about arithmetic, including the fact that two pairs make four.';
    const transport = fixture(() => contentResponse(notes));
    assert.equal(await transport.adapter.extractVisualTextFromPdfBufferWithGemini(pdf), notes);
    assert.equal(transport.requests[0].body.contents[0].parts[0].inlineData.data, pdf.toString('base64'));
    assert.equal(transport.requests[0].body.generationConfig?.responseMimeType, undefined);
});

test('SDK remains Developer API, bounds requests and sends keys only through the auth header', async () => {
    const transport = fixture(undefined, { GOOGLE_GENAI_USE_ENTERPRISE: 'true' });
    await transport.adapter.generateQuizWithGemini('Fixture notes', 1);
    assert.equal(transport.clients[0].enterprise, false);
    assert.equal(transport.clients[0].timeout, 60000);
    assert.equal(transport.clients[0].attempts, 1);
    assert.equal(transport.requests[0].authenticated, true);
    assert.equal(transport.requests[0].keyInUrl, false);
    assert.equal(transport.requests[0].hasAbortSignal, true);
});

test('configured model failure falls back once without multiplying SDK HTTP retries', async () => {
    const transport = fixture((_, count) => count === 1 ? Response.json({ error: { code: 503, message: 'PRIVATE_FIXTURE_UPSTREAM_BODY', status: 'UNAVAILABLE' } }, { status: 503 }) : contentResponse(JSON.stringify([question])));
    assert.equal((await transport.adapter.generateQuizWithGemini('Fixture notes', 1)).length, 1);
    assert.equal(transport.requests.length, 2);
    assert.match(transport.requests[1].path, /models\/gemini-flash-latest:generateContent$/);
    assert.ok(!transport.logs.some(message => message.includes('PRIVATE_FIXTURE_UPSTREAM_BODY')));
});

test('malformed question output retries the model fallback rather than fabricating an answer', async () => {
    const transport = fixture((_, count) => contentResponse(count === 1 ? '[{}]' : JSON.stringify([question])));
    assert.equal((await transport.adapter.generateQuizWithGemini('Fixture notes', 1))[0].options[1], '4');
    assert.equal(transport.requests.length, 2);
});

test('duplicate configured/fallback model does not send duplicate failing requests or leak error bodies', async () => {
    const transport = fixture(() => Response.json({ error: { code: 503, message: 'PRIVATE_FIXTURE_UPSTREAM_BODY', status: 'UNAVAILABLE' } }, { status: 503 }), { GEMINI_MODEL: 'gemini-flash-latest' });
    await assert.rejects(transport.adapter.generateQuizWithGemini('Fixture notes', 1), /^Error: Failed to generate quiz using Gemini\.$/);
    assert.equal(transport.requests.length, 1);
    assert.ok(!transport.logs.some(message => message.includes('PRIVATE_FIXTURE_UPSTREAM_BODY')));
});

test('automatic SDK continuation is disabled so one complete JSON response remains one request', async () => {
    const transport = fixture(() => contentResponse(JSON.stringify([question]), {
        candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify([question]) }] }, finishReason: 'CONTINUATION' }],
        continuationToken: 'fixture-continuation-token',
    }));
    assert.equal((await transport.adapter.generateQuizWithGemini('Fixture notes', 1)).length, 1);
    assert.equal(transport.requests.length, 1);
});

test('missing Gemini configuration fails before constructing a client or making a request', async () => {
    const transport = fixture(undefined, { GEMINI_API_KEY: '' });
    await assert.rejects(transport.adapter.generateQuizWithGemini('Fixture notes', 1), /Gemini API key is missing/);
    assert.equal(transport.clients.length, 0);
    assert.equal(transport.requests.length, 0);
});

test('short OCR responses continue to the distinct model fallback', async () => {
    const notes = 'Synthetic full OCR study notes that are long enough to be used by the downstream NVIDIA text pipeline.';
    const transport = fixture((_, count) => contentResponse(count === 1 ? 'short' : notes));
    assert.equal(await transport.adapter.extractVisualTextFromPdfBufferWithGemini(pdf), notes);
    assert.equal(transport.requests.length, 2);
});
