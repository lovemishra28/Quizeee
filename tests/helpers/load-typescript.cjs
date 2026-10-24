const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');

/** Execute actual source with explicit external-service doubles; no generated source is committed. */
function loadSource(relative, { env = {}, overrides = {}, logs = [] } = {}, cache = new Map()) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const exports = {};
    cache.set(filename, exports);
    const requireModule = name => {
        if (name in overrides) return overrides[name];
        if (name === 'server-only') return {};
        if (name === 'next/headers') return { headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1' }) };
        if (name.startsWith('@/') || name.startsWith('.')) {
            const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(filename), name);
            const found = [base, `${base}.ts`, path.join(base, 'index.ts')].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
            if (found) return loadSource(found, { env, overrides, logs }, cache);
        }
        return require(require.resolve(name, { paths: [root] }));
    };
    const logger = (...args) => logs.push(args.map(arg => typeof arg === 'string' ? arg : '[object]').join(' '));
    vm.runInNewContext(source, {
        exports, module: { exports }, require: requireModule,
        process: { env: { ...process.env, ...env } },
        console: { log: logger, warn: logger, error: logger },
        Buffer, FormData, File, Blob, Headers, Request, Response, fetch, URL,
        AbortSignal, AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
        crypto: require('node:crypto').webcrypto,
    }, { filename });
    return exports;
}

module.exports = { loadSource };
