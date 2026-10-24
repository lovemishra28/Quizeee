const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-typescript.cjs');
const { ids, token, startFixture } = require('./helpers/supabase-fixture.cjs');

let fixture;
before(async () => { fixture = await startFixture(); });
after(async () => { await fixture.close(); });
beforeEach(() => fixture.reset());
const load = file => loadSource(file, { env: fixture.env });
const validSubmission = () => ({ quizId: ids.quiz, accessToken: token(ids.student), sessionId: ids.session, answers: { [ids.question1]: 0, [ids.question2]: 1 } });

test('an unauthenticated caller cannot forge static results for another student', async () => {
    const input = validSubmission(); delete input.accessToken; input.userId = ids.other;
    const result = await load('src/actions/submitStaticQuiz.ts').submitStaticQuiz(input);
    assert.equal(result.success, false);
    assert.equal(fixture.state.submissions.length, 0);
});

test('verified identity, not supplied identity or score, controls static grading', async () => {
    const result = await load('src/actions/submitStaticQuiz.ts').submitStaticQuiz({ ...validSubmission(), userId: ids.other, score: 999999 });
    assert.equal(result.success, true);
    assert.equal(result.score, 2);
    assert.equal(fixture.state.submissions.length, 2);
    assert.ok(fixture.state.submissions.every(row => row.student_id === ids.student && row.score_awarded === 10));
});

test('a teacher token cannot create student assessment results', async () => {
    const result = await load('src/actions/submitStaticQuiz.ts').submitStaticQuiz({ ...validSubmission(), accessToken: token(ids.teacher) });
    assert.equal(result.success, false); assert.equal(fixture.state.submissions.length, 0);
});

test('closed static quizzes are rejected server-side', async () => {
    fixture.state.quizzes[0].available_until = new Date(Date.now() - 60000).toISOString();
    assert.equal((await load('src/actions/submitStaticQuiz.ts').submitStaticQuiz(validSubmission())).success, false);
    assert.equal(fixture.state.submissions.length, 0);
});

test('static grading rejects competitive quizzes and mismatched sessions', async () => {
    const action = load('src/actions/submitStaticQuiz.ts').submitStaticQuiz;
    assert.equal((await action({ ...validSubmission(), quizId: ids.liveQuiz })).success, false);
    assert.equal((await action({ ...validSubmission(), sessionId: ids.liveSession })).success, false);
    assert.equal(fixture.state.submissions.length, 0);
});

test('unknown questions and out-of-range choices are rejected before writing', async () => {
    const action = load('src/actions/submitStaticQuiz.ts').submitStaticQuiz;
    assert.equal((await action({ ...validSubmission(), answers: { [ids.question1]: 99 } })).success, false);
    assert.equal((await action({ ...validSubmission(), answers: { [ids.liveQuiz]: 0 } })).success, false);
    assert.equal(fixture.state.submissions.length, 0);
});

test('sequential static replay does not add duplicate results', async () => {
    const action = load('src/actions/submitStaticQuiz.ts').submitStaticQuiz;
    assert.equal((await action(validSubmission())).success, true);
    assert.equal((await action(validSubmission())).success, false);
    assert.equal(fixture.state.submissions.length, 2);
});

test('separate instant quizzes receive separate host accounts and credentials', async () => {
    const action = load('src/actions/instantQuiz.ts').createInstantQuizAction;
    const input = { title: 'Fixture quiz', questions: [{ question_text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correct_option_index: 1 }] };
    const first = await action(input), second = await action(input);
    assert.equal(first.success, true); assert.equal(second.success, true);
    assert.ok(first.hostEmail !== second.hostEmail);
    assert.ok(first.hostPassword !== second.hostPassword);
    assert.ok(fixture.state.quizzes.at(-1).teacher_id !== fixture.state.quizzes.at(-2).teacher_id);
});

test('malformed instant content is rejected before any guest account or quiz is created', async () => {
    const previousUsers = fixture.state.users.length;
    const result = await load('src/actions/instantQuiz.ts').createInstantQuizAction({ title: 'Fixture', questions: [{ question_text: '', options: ['A', 'B'], correct_option_index: 99 }] });
    assert.equal(result.success, false); assert.equal(fixture.state.users.length, previousUsers); assert.equal(fixture.state.quizzes.length, 2);
});

test('guest accounts cannot be minted for static, finished, or invalid rooms', async () => {
    const action = load('src/actions/instantQuiz.ts').joinInstantQuizAction;
    const previousUsers = fixture.state.users.length;
    assert.equal((await action({ roomCode: '123456', nickname: 'Fixture Guest' })).success, false);
    fixture.state.quiz_sessions[1].status = 'finished';
    assert.equal((await action({ roomCode: '654321', nickname: 'Fixture Guest' })).success, false);
    assert.equal((await action({ roomCode: '1234', nickname: 'Fixture Guest' })).success, false);
    assert.equal(fixture.state.users.length, previousUsers);
});

test('guest nickname limits are enforced on the server', async () => {
    const result = await load('src/actions/instantQuiz.ts').joinInstantQuizAction({ roomCode: '654321', nickname: 'X'.repeat(1000) });
    assert.equal(result.success, false); assert.equal(fixture.state.users.length, 3);
});

test('a valid guest join retains only the student role', async () => {
    const result = await load('src/actions/instantQuiz.ts').joinInstantQuizAction({ roomCode: '654321', nickname: 'Fixture Guest' });
    assert.equal(result.success, true);
    assert.equal(fixture.state.profiles.at(-1).role, 'student');
    assert.ok(fixture.state.users.at(-1).user_metadata.is_guest);
});
