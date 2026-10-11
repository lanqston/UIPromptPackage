// Local-only integration harness. Never imported by deployment functions.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { testRedis } from './helpers/redis.mjs';
import { passwordHash } from '../server/admin-auth.mjs';
import { saveRecord } from '../server/admin-store.mjs';
import { makeAdminHandler } from '../server/admin-handler.mjs';
import { makeSubmissionHandler } from '../server/submissions.mjs';
import { makePublicHandler } from '../server/public-community.mjs';
import { makeLaunchHandler } from '../server/launch-pages.mjs';
import { makeSavedItemHandler } from '../server/saved-items.mjs';
if(process.env.VERCEL)throw new Error('Local fixture only.');
const redis=testRedis(10);await redis(['FLUSHDB']);
const origin='http://127.0.0.1:4322';
const env={NODE_ENV:'test',DIGIVATED_ADMIN_ORIGIN:origin,SUBMISSIONS_ORIGIN:origin,DIGIVATED_ADMIN_PASSWORD_HASH:await passwordHash('Local fixture password only!'),DIGIVATED_ADMIN_SESSION_SECRET:randomBytes(32).toString('hex')};
const project={id:'fixture-project',name:'Fieldnotes',creator:'Example Creator',email:'private@example.test',notes:'PRIVATE REVIEW NOTE',description:'A quiet workspace for collecting ideas and turning small observations into your next independent project.',category:'Apps',url:'https://example.com',consent:true,status:'pending',date:new Date().toISOString()};
await redis(['SET','digivated:submission:fixture-project',JSON.stringify(project)]);
await saveRecord(redis,'submission',{...project,revision:0,status:'approved',page:{bio:'A creator-supplied biography used only for this local test.',alt:'',ctaLabel:'Try the app',ctaUrl:'https://example.com',consent:true},pageAction:'publish'});
await saveRecord(redis,'resource',{id:'fixture-resource',revision:0,status:'published',title:'Sketch before you build',description:'A practical resource for turning ideas into a first prototype.',category:'UI/UX',publishedDate:'2026-10-11',readingTime:3,content:'## Start with one idea\n\nWrite down the smallest useful thing you can make.',related:''});
const handlers={'/api/admin':makeAdminHandler({redis,env}),'/api/submissions':makeSubmissionHandler({redis,env}),'/api/projects':makePublicHandler('projects',{redis}),'/api/content':makePublicHandler('content',{redis}),'/api/project-page':makeLaunchHandler({redis}),'/api/saved-item':makeSavedItemHandler({redis})};
const root=resolve('dist');
createServer(async(req,res)=>{
 const url=new URL(req.url,origin);
 if(url.pathname.startsWith('/projects/'))return handlers['/api/project-page'](req,res);
 if(handlers[url.pathname])return handlers[url.pathname](req,res);
 if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('{"status":"unconfigured","views":null}');return;}
 let path=resolve(root,'.'+url.pathname);if(!path.startsWith(root+'/')&&path!==root){res.writeHead(403);res.end();return;}
 if(!extname(path))path+='/index.html';
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end('Not found');}
}).listen(4322,'127.0.0.1',()=>console.log('Isolated launch/collections preview on '+origin));
