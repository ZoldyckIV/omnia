const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'wishes.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Ensure wishes.json exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readWishes() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (e) {
    return [];
  }
}

function writeWishes(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write wishes.json:', e);
    return false;
  }
}

function parseJsonBody(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body || '{}');
      callback(null, parsed);
    } catch (err) {
      callback(err, null);
    }
  });
}

const server = http.createServer((req, res) => {
  // Common CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // API Route: GET /api/wishes or /api.php or api.php
  if ((urlPath === '/api/wishes' || urlPath === '/api.php' || urlPath.endsWith('/api.php')) && req.method === 'GET') {
    const list = readWishes();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(list));
    return;
  }

  // API Route: POST /api/wishes or /api.php or api.php
  if ((urlPath === '/api/wishes' || urlPath === '/api.php' || urlPath.endsWith('/api.php')) && req.method === 'POST') {
    parseJsonBody(req, (err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        return;
      }

      // Handle delete action
      if (data.action === 'delete' && data.id) {
        const list = readWishes();
        const updatedList = list.filter(item => String(item.id) !== String(data.id));
        writeWishes(updatedList);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, list: updatedList }));
        return;
      }

      if (!data.name || !data.message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing fields' }));
        return;
      }

      const list = readWishes();
      const newEntry = {
        id: data.id || ('msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
        name: data.name.trim(),
        message: data.message.trim(),
        time: data.time || new Date().toLocaleString('ar-EG')
      };

      list.unshift(newEntry);
      writeWishes(list);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, item: newEntry, list: list }));
    });
    return;
  }

  // API Route: POST /api/wishes/delete (Delete a wish by ID)
  if (urlPath === '/api/wishes/delete' && req.method === 'POST') {
    parseJsonBody(req, (err, data) => {
      if (err || !data.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing ID' }));
        return;
      }

      const list = readWishes();
      const updatedList = list.filter(item => String(item.id) !== String(data.id));
      writeWishes(updatedList);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, list: updatedList }));
    });
    return;
  }

  // Static files handling
  let reqPath = decodeURI(urlPath);
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/ with wishes.json persistent storage`);
});
