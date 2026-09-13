import { Plugin } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { mkdirSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), 'logs');
const WS_PATH = '/__log_ws';

export function logWsPlugin(): Plugin {
    let clients: Set<WebSocket> = new Set();

    function ensureDir() {
        if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    }

    function write(level: string, message: string) {
        ensureDir();
        const ts = new Date().toISOString();
        const line = `[${ts}] [${level}] ${message}\n`;
        appendFileSync(join(LOG_DIR, 'client.log'), line);
        if (level === 'deco') {
            appendFileSync(join(LOG_DIR, 'deco.log'), line);
        }
    }

    return {
        name: 'vite-plugin-log-ws',
        apply: 'serve',

        configureServer(server) {
            if (!server.httpServer) return;
            const http = server.httpServer as HttpServer;
            const wss = new WebSocketServer({ noServer: true });

            http.on('upgrade', (req, socket, head) => {
                if (req.url === WS_PATH) {
                    wss.handleUpgrade(req, socket as any, head, (ws) => {
                        wss.emit('connection', ws, req);
                    });
                }
            });

            wss.on('connection', (ws) => {
                clients.add(ws);
                write('info', `[WS] Client connected (${clients.size} total)`);
                ws.on('message', (raw) => {
                    try {
                        const msg = JSON.parse(raw.toString());
                        write(msg.level || 'log', msg.msg || '');
                    } catch {}
                });
                ws.on('close', () => { clients.delete(ws); });
                ws.on('error', () => { clients.delete(ws); });
            });

            server.middlewares.use((req, res, next) => {
                if (req.url === '/__log_http' && req.method === 'POST') {
                    let body = '';
                    req.on('data', (chunk) => { body += chunk; });
                    req.on('end', () => {
                        try {
                            const entries = JSON.parse(body);
                            if (Array.isArray(entries)) {
                                for (const e of entries) write(e.level || 'log', e.msg || '');
                            }
                        } catch {}
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('ok');
                    });
                    return;
                }
                next();
            });
        },

        transformIndexHtml() {
            return [{
                tag: 'script',
                attrs: { defer: true },
                children: injectScript,
                injectTo: 'head'
            }];
        }
    };
}

const injectScript = `
(function(){
  try{
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = proto + '//' + location.host + '${WS_PATH}';
    var ws = null, buf = [], flushing = false;

    function connect(){
      try{
        ws = new WebSocket(url);
        ws.onopen = function(){
          if(buf.length) flush();
        };
        ws.onclose = function(){ ws = null; setTimeout(connect, 2000); };
        ws.onerror = function(){ ws = null; };
      }catch(e){ ws = null; setTimeout(connect, 2000); }
    }
    connect();

    function send(entry){
      if(ws && ws.readyState === 1){ ws.send(JSON.stringify(entry)); }
      else{ buf.push(entry); }
    }

    function flush(){
      if(flushing || !ws || ws.readyState !== 1 || !buf.length) return;
      flushing = true;
      var batch = buf.splice(0, 50);
      ws.send(JSON.stringify(batch));
      flushing = false;
      if(buf.length) setTimeout(flush, 50);
    }

    setInterval(function(){ flush(); }, 500);

    var orig = {};
    ['log','warn','error','info'].forEach(function(l){
      orig[l] = console[l];
      console[l] = function(){
        var args = Array.prototype.slice.call(arguments);
        orig[l].apply(console, args);
        try{
          var msg = args.map(function(a){
            if(a instanceof Error) return a.stack || (a.name + ': ' + a.message);
            if(typeof a === 'object'){ try{return JSON.stringify(a)}catch(e){return String(a)} }
            return String(a);
          }).join(' ');
          send({ level: l, msg: msg });
        }catch(e){}
      };
    });

    window.addEventListener('error', function(e){
      send({ level: 'error', msg: '[UNCAUGHT] ' + (e.error && e.error.stack || e.message || '') });
    });
    window.addEventListener('unhandledrejection', function(e){
      var r = e.reason;
      send({ level: 'error', msg: '[REJECTION] ' + (r && (r.stack || r.message || String(r)) || '') });
    });
  }catch(e){}
})();
`;

export default logWsPlugin;
