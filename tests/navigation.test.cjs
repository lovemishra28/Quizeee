const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-typescript.cjs');

test('known internal quiz return paths are preserved', () => {
    const { safeAuthReturnPath } = loadSource('src/lib/authRedirect.ts');
    assert.equal(safeAuthReturnPath('/quiz/live/student/654321'), '/quiz/live/student/654321');
    assert.equal(safeAuthReturnPath('/quiz/static/fixture?session=fixture'), '/quiz/static/fixture?session=fixture');
});

test('external, encoded scheme-relative, backslash and auth-loop redirects are rejected', () => {
    const { safeAuthReturnPath } = loadSource('src/lib/authRedirect.ts');
    for (const value of ['https://example.invalid', '//example.invalid', '/%2fexample.invalid', '/\\example.invalid', '/auth', '/dashboard/teacher/../../auth', '/quiz/live/student/123456\n']) assert.equal(safeAuthReturnPath(value), undefined);
});
