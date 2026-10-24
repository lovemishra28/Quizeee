const http = require('node:http');
const { randomUUID } = require('node:crypto');

const ids = {
    teacher: '11111111-1111-4111-8111-111111111111',
    student: '22222222-2222-4222-8222-222222222222',
    other: '33333333-3333-4333-8333-333333333333',
    quiz: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    liveQuiz: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    session: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    liveSession: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    question1: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    question2: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
};

function token(id) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.not-a-valid-production-signature`;
}

function createState() {
    return {
        profiles: [{ id: ids.student, role: 'student' }, { id: ids.teacher, role: 'teacher' }, { id: ids.other, role: 'student' }],
        users: [ids.student, ids.teacher, ids.other].map(id => ({ id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: {}, user_metadata: {} })),
        quizzes: [{ id: ids.quiz, teacher_id: ids.teacher, type: 'static', available_from: new Date(Date.now() - 60000).toISOString(), available_until: new Date(Date.now() + 3600000).toISOString() }, { id: ids.liveQuiz, teacher_id: ids.teacher, type: 'competitive' }],
        quiz_sessions: [{ id: ids.session, quiz_id: ids.quiz, status: 'waiting', room_code: '123456' }, { id: ids.liveSession, quiz_id: ids.liveQuiz, status: 'waiting', room_code: '654321' }],
        questions: [{ id: ids.question1, quiz_id: ids.quiz, options: ['A', 'B', 'C', 'D'], correct_option_index: 0, order_index: 1 }, { id: ids.question2, quiz_id: ids.quiz, options: ['A', 'B', 'C', 'D'], correct_option_index: 1, order_index: 2 }],
        submissions: [], requests: [], failTable: null,
    };
}

async function startFixture() {
    const holder = { state: createState() };
    const server = http.createServer(async (request, response) => {
        const state = holder.state;
        const url = new URL(request.url, 'http://127.0.0.1');
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const payload = raw ? JSON.parse(raw) : {};
        let subject;
        try { subject = JSON.parse(Buffer.from((request.headers.authorization || '').split('.')[1], 'base64url').toString()).sub; } catch {}
        state.requests.push({ path: url.pathname, method: request.method, subject });
        const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(status === 204 ? undefined : JSON.stringify(value)); };
        if (url.pathname === '/auth/v1/user') {
            const found = state.users.find(user => user.id === subject);
            return found ? send(200, found) : send(401, { msg: 'Invalid fixture session' });
        }
        if (url.pathname === '/auth/v1/admin/users' && request.method === 'POST') {
            const user = { id: randomUUID(), aud: 'authenticated', role: 'authenticated', email: payload.email, app_metadata: {}, user_metadata: payload.user_metadata };
            state.users.push(user);
            return send(200, user);
        }
        const table = url.pathname.split('/')[3];
        if (!state[table] || table === 'requests') return send(404, { message: 'Unknown fixture endpoint' });
        if (state.failTable === table) return send(400, { message: 'Synthetic write/read failure', code: 'FIXTURE_FAILURE' });
        let rows = state[table].map(row => table === 'quiz_sessions' ? { ...row, quizzes: state.quizzes.find(quiz => quiz.id === row.quiz_id) } : { ...row });
        for (const [key, condition] of url.searchParams) {
            if (condition.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === condition.slice(3));
            if (condition.startsWith('in.(')) rows = rows.filter(row => condition.slice(4, -1).split(',').includes(String(row[key])));
        }
        if (url.searchParams.has('limit')) rows = rows.slice(0, Number(url.searchParams.get('limit')));
        if (request.method === 'POST') {
            rows = (Array.isArray(payload) ? payload : [payload]).map(input => {
                const row = { id: randomUUID(), ...input };
                const existing = request.headers.prefer?.includes('resolution=merge-duplicates') ? state[table].find(value => value.id === row.id) : null;
                if (existing) Object.assign(existing, row); else state[table].push(row);
                return row;
            });
        }
        if (request.method === 'DELETE') {
            const removed = new Set(rows.map(row => row.id));
            state[table] = state[table].filter(row => !removed.has(row.id));
            return send(204);
        }
        if (request.method === 'POST' && !request.headers.prefer?.includes('return=representation')) return send(201, null);
        if (request.headers.accept?.includes('application/vnd.pgrst.object+json')) return rows.length === 1 ? send(200, rows[0]) : send(406, { code: 'PGRST116', message: 'Fixture row not found' });
        return send(200, rows);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    holder.env = { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public-placeholder', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-placeholder' };
    holder.reset = () => { holder.state = createState(); };
    holder.close = () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    return holder;
}

module.exports = { ids, token, startFixture };
