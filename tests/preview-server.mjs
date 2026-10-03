// Local-only UI fixture harness. Never imported by API handlers or production code.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { makeHandler } from '../server/handler.mjs';
import { AccessError, PRODUCT_ID } from '../server/access.mjs';
const root=resolve('dist');
const env={ACCESS_ENABLED:'true',APP_ORIGIN:'https://fixture.test',GUMROAD_PRODUCT_ID:PRODUCT_ID,SESSION_SECRET:randomBytes(32).toString('hex'),EDITION_KEY:(await readFile('.private/owner-key.txt','utf8')).trim()};
const verify=async license=>{if(license!=='A1B2C3D4-E5F60718-9ABCDEF0-1234ABCD')throw new AccessError(401,'invalid_access','We couldn’t verify active access. Copy your license key from your Gumroad receipt and try again.');return {saleId:'local-fixture'};};
const headers=JSON.parse(await readFile('vercel.json','utf8')).headers[0].headers;
createServer(async(req,res)=>{
 for(const h of headers)if(h.key!=='Content-Security-Policy')res.setHeader(h.key,h.value);
 res.setHeader('Content-Security-Policy',headers.find(h=>h.key==='Content-Security-Policy').value.replace('; upgrade-insecure-requests',''));
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.startsWith('/api/')){req.headers.origin=env.APP_ORIGIN;return makeHandler(pathname.slice(5),{env,verify,limit:async()=>{},audit:()=>{}})(req,res);}
 let path=resolve(root,'.'+pathname);if(!path.startsWith(root+'/')&&path!==root){res.writeHead(403);res.end();return;}
 if(!extname(path))path+='/index.html';
 try{const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Local fixture preview: http://localhost:4173'));
