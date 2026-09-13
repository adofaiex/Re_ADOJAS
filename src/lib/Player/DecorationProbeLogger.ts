/**
 * Decoration probe logger — sends logs via the Vite WS plugin to logs/deco.log.
 * Same mechanism as the existing logs/client.log pipeline.
 *
 * Disabled by default (can be a per-frame cost on huge levels). Enable with
 * `?decoProbe=1` in the URL or `localStorage.setItem('decoProbe','1')`.
 */

const ENABLED = (() => {
    try {
        if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('decoProbe') === '1') return true;
        if (typeof localStorage !== 'undefined' && localStorage.getItem('decoProbe') === '1') return true;
    } catch { /* ignore */ }
    return false;
})();

let ws: WebSocket | null = null;
const buf: { level: string; msg: string }[] = [];
let flushing = false;

function connect() {
    try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${proto}//${location.host}/__log_ws`);
        ws.onopen = () => { if (buf.length) flush(); };
        ws.onclose = () => { ws = null; setTimeout(connect, 2000); };
        ws.onerror = () => { ws = null; };
    } catch { ws = null; setTimeout(connect, 2000); }
}
if (ENABLED) connect();

function send(entry: { level: string; msg: string }) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(entry));
    else buf.push(entry);
}

function flush() {
    if (flushing || !ws || ws.readyState !== 1 || !buf.length) return;
    flushing = true;
    const batch = buf.splice(0, 50);
    ws.send(JSON.stringify(batch));
    flushing = false;
    if (buf.length) setTimeout(flush, 50);
}

if (ENABLED) setInterval(flush, 500);

export function probeLog(msg: string): void {
    if (!ENABLED) return;
    send({ level: 'deco', msg });
}

export function probeFlush(): void {
    if (!ENABLED) return;
    flush();
}
