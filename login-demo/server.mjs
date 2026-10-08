import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const dir = dirname(fileURLToPath(import.meta.url));
const files = new Map([['/','index.html'],['/app.js','app.js'],['/core.mjs','core.mjs'],['/style.css','style.css'],['/setup.sql','setup.sql']]);
const mime = {html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',sql:'text/plain'};
export function createStaticServer() {
  return createServer(async (req,res)=>{
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {res.writeHead(403);res.end('Host rejected');return;}
    const path = new URL(req.url,'http://'+host).pathname;
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end('Static files only');return;}
    const file = files.get(path);
    if (!file) {res.writeHead(404);res.end('Not found');return;}
    try {
      const bytes = await readFile(join(dir,file));
      res.writeHead(200,{
        'Content-Type':mime[file.split('.').pop()]+'; charset=utf-8',
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });res.end(req.method === 'HEAD' ? undefined : bytes);
    }catch{res.writeHead(500);res.end('File unavailable');}
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createStaticServer(), port = Number(process.env.PORT || 8772);
  server.on('error',e=>{console.error(e.code === 'EADDRINUSE' ? 'Port '+port+' is busy. Close the old terminal or set PORT.' : e.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('Supabase Login Demo: http://127.0.0.1:'+port+'\nThis server serves files only. Supabase performs all login and data checks.\nLeave this terminal open. Ctrl+C stops it.'));
}
