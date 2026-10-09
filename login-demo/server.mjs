import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_PORT,
  SERVER_HOST,
  ALLOWED_HOST,
  ALLOWED_METHODS,
  STATIC_FILES,
  CONTENT_TYPES,
  SECURITY_HEADERS,
} from './server-config.mjs';
const directory = dirname(fileURLToPath(import.meta.url));
const files = new Map(STATIC_FILES);

export function createStaticServer() {
  return createServer(async (request, response) => {
    const host = request.headers.host || '';
    if (!ALLOWED_HOST.test(host)) {
      response.writeHead(403);
      response.end('Host rejected');
      return;
    }
    if (!ALLOWED_METHODS.includes(request.method)) {
      response.writeHead(405);
      response.end('Static files only');
      return;
    }
    const path = new URL(request.url, 'http://' + host).pathname;
    const file = files.get(path);
    if (!file) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    try {
      const bytes = await readFile(join(directory, file));
      const extension = file.split('.').pop();
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extension] + '; charset=utf-8',
        ...SECURITY_HEADERS,
        ...(path === '/swagger' || path === '/student/swagger.html'
          ? {
              'Content-Security-Policy': SECURITY_HEADERS['Content-Security-Policy'].replace(
                "style-src 'self'",
                "style-src 'self' 'unsafe-inline'",
              ),
            }
          : {}),
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end('File unavailable');
    }
  });
}

function startServer() {
  const server = createStaticServer();
  const port = Number(process.env.PORT || DEFAULT_PORT);
  server.on('error', (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? 'Port ' + port + ' is busy. Close the old terminal or set PORT.'
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(port, SERVER_HOST, () => {
    console.log('Supabase Login Demo: http://' + SERVER_HOST + ':' + port);
    console.log('This server serves files only. Supabase performs all login and data checks.');
    console.log('Leave this terminal open. Ctrl+C stops it.');
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
