/** Only known application destinations are accepted, never an external or auth-loop URL. */
export function safeAuthReturnPath(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length > 1500 || !value.startsWith('/') || value.startsWith('//')) return undefined;
    try {
        const decoded = decodeURIComponent(value);
        if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return undefined;
        const url = new URL(value, 'https://quizeee.invalid');
        if (url.origin !== 'https://quizeee.invalid' || !/^\/(dashboard\/(teacher|student)(\/|$)|quiz\/(static|live\/(student|host))\/)/.test(url.pathname)) return undefined;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch { return undefined; }
}
