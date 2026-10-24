const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-typescript.cjs');

const question = { question_text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correct_option_index: 1, explanation: 'Two pairs make four.', subtopic: 'Arithmetic' };
const parser = () => loadSource('src/lib/ai/types.ts').parseAndNormalizeQuestions;

test('valid fenced JSON and wrapped question arrays preserve the actual answer', () => {
    assert.equal(parser()('```json\n' + JSON.stringify([question]) + '\n```', 1)[0].correct_option_index, 1);
    assert.equal(parser()(JSON.stringify({ questions: [question] }), 1)[0].options[1], '4');
});

for (const [name, value, count] of [
    ['empty arrays', [], 1],
    ['fabricated missing fields', [{}], 1],
    ['fractional answers', [{ ...question, correct_option_index: 1.9 }], 1],
    ['out-of-range answers', [{ ...question, correct_option_index: 9 }], 1],
    ['duplicate choices', [{ ...question, options: ['A', 'a', 'B', 'C'] }], 1],
    ['wrong question count', [question], 2],
]) {
    test(`AI parsing rejects ${name}`, () => assert.throws(() => parser()(JSON.stringify(value), count)));
}

test('raw invalid provider output is not logged', () => {
    const logs = [];
    const parse = loadSource('src/lib/ai/types.ts', { logs }).parseAndNormalizeQuestions;
    assert.throws(() => parse('PRIVATE_FIXTURE_RESPONSE', 1));
    assert.ok(!logs.some(line => line.includes('PRIVATE_FIXTURE_RESPONSE')));
});

function generationDouble() {
    const calls = [], logs = [];
    let disposed = 0;
    const ai = { generateQuizAI: async (text, count) => { calls.push({ text, count }); return { questions: [question], provider: 'nvidia' }; }, generateQuizAIFromPdfBuffer: async () => ({ questions: [question], provider: 'gemini' }) };
    const pdf = { PDFParse: class { async getInfo() { return { total: 1 }; } async getText() { return { text: 'Synthetic study notes for the fixture. '.repeat(3) }; } async destroy() { disposed++; } } };
    const action = loadSource('src/actions/generateQuiz.ts', { logs, overrides: { '@/lib/ai': ai, 'pdf-parse': pdf } }).processStudyMaterial;
    return { action, calls, logs, disposed: () => disposed };
}

test('unbounded count, provider and file inputs are rejected before generation', async () => {
    const fixture = generationDouble();
    const form = new FormData(); form.set('topic', 'Arithmetic'); form.set('questionCount', '100000');
    assert.equal((await fixture.action(form)).success, false);
    form.set('questionCount', '1'); form.set('provider', 'unsupported');
    assert.equal((await fixture.action(form)).success, false);
    assert.equal(fixture.calls.length, 0);
});

test('plain-text uploads use their actual notes and do not enter the PDF pipeline', async () => {
    const fixture = generationDouble(); const form = new FormData();
    form.set('file', new File(['Synthetic plain-text fixture notes.'], 'fixture.txt', { type: 'text/plain' })); form.set('questionCount', '1');
    assert.equal((await fixture.action(form)).success, true);
    assert.match(fixture.calls[0].text, /plain-text fixture/); assert.equal(fixture.disposed(), 0);
});

test('PDF resources are disposed after extraction', async () => {
    const fixture = generationDouble(); const form = new FormData();
    form.set('file', new File(['%PDF-1.4\nfixture'], 'fixture.pdf', { type: 'application/pdf' })); form.set('questionCount', '1');
    assert.equal((await fixture.action(form)).success, true); assert.equal(fixture.disposed(), 1);
});

test('raw study prompts are never copied into server logs', async () => {
    const fixture = generationDouble(); const form = new FormData(); form.set('topic', 'PRIVATE_FIXTURE_STUDY_PROMPT'); form.set('questionCount', '1');
    await fixture.action(form); assert.ok(!fixture.logs.some(line => line.includes('PRIVATE_FIXTURE_STUDY_PROMPT')));
});

test('generation admission caps concurrency and releases capacity after failure', async () => {
    const slots = loadSource('src/lib/server/rateLimit.ts');
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    const pending = [1, 2, 3].map(() => slots.withGenerationSlot(() => barrier));
    await assert.rejects(slots.withGenerationSlot(async () => 'unexpected'), /busy/i);
    release(); await Promise.all(pending);
    await assert.rejects(slots.withGenerationSlot(async () => { throw new Error('Fixture failure'); }), /Fixture failure/);
    assert.equal(await slots.withGenerationSlot(async () => 'available'), 'available');
});
