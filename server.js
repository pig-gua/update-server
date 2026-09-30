'use strict';

/**
 * 更新服务端 (零依赖, 生产可换成任意静态服务 + 一个 JSON 接口)
 *
 * 接口:
 *   GET /api/updates/check?app=host&version=0.1.0
 *     -> { update: true, version, url, sha256 } 或 { update: false }
 *   GET /api/updates/latest  -> updates.json 全量
 *   GET /packages/<file>     -> 安装包下载 (带 sha256 校验值由客户端验证)
 *
 * 版本清单在 updates.json, 发包时更新它并把包放进 packages/ 即可。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 9123;
const ROOT = __dirname;
const UPDATES_FILE = path.join(ROOT, 'updates.json');

function readUpdates() {
  return JSON.parse(fs.readFileSync(UPDATES_FILE, 'utf8'));
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/updates/check') {
    const app = url.searchParams.get('app');
    const version = url.searchParams.get('version') || '0.0.0';
    const info = readUpdates()[app];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!info) {
      res.end(JSON.stringify({ update: false, error: `unknown app: ${app}` }));
      return;
    }
    if (compareVersions(info.version, version) > 0) {
      res.end(JSON.stringify({ update: true, ...info }));
    } else {
      res.end(JSON.stringify({ update: false, version: info.version }));
    }
    return;
  }

  if (url.pathname === '/api/updates/latest') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(readUpdates()));
    return;
  }

  if (url.pathname.startsWith('/packages/')) {
    const file = path.join(ROOT, 'packages', path.basename(url.pathname));
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fs.statSync(file).size);
    fs.createReadStream(file).pipe(res);
    return;
  }

  res.statusCode = 404;
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`update-server listening on http://127.0.0.1:${PORT}`);
});
