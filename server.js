#!/usr/bin/env node
/**
 * 庭有五棵树 · 本地静态服务器
 * ------------------------------------------------------------
 * 游戏本身不需要服务器：直接双击 index.html 即可运行。
 * 这个文件只提供一个零依赖的本地 HTTP 服务，方便：
 *   - 手机/平板通过局域网访问；
 *   - 某些浏览器对 file:// 的缓存/调试限制；
 *   - 录制与分发。
 *
 * 用法:
 *   node server.js            # http://127.0.0.1:8080
 *   PORT=3000 node server.js  # 自定义端口
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const started = Date.now();
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Bad request');
  }

  if (pathname === '/') pathname = '/index.html';

  // 只允许访问项目根目录内的文件，防止 ../ 路径穿越。
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 · 这一页还没有被写进庭院。');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('end', () => {
      const ms = Date.now() - started;
      if (process.env.QUIET !== '1') console.log(`  ${res.statusCode} ${req.method} ${pathname} (${ms}ms)`);
    });
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end('Stream error');
    });
  });
});

server.listen(PORT, HOST, () => {
  const local = `http://127.0.0.1:${PORT}`;
  console.log('\n  庭有五棵树 · Court of Five Trees');
  console.log('  ─────────────────────────────');
  console.log(`  本地:   ${local}`);
  if (HOST === '0.0.0.0') {
    const nets = os.networkInterfaces();
    Object.keys(nets).forEach((name) => {
      (nets[name] || []).forEach((net) => {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  局域网: http://${net.address}:${PORT}  (${name})`);
        }
      });
    });
  }
  console.log('  按 Ctrl+C 停止。\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  端口 ${PORT} 已被占用。试试: PORT=3001 node server.js\n`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
