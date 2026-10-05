import { randomBytes } from 'node:crypto';
import { credentials } from '../server/x-publisher.mjs';
import { redisClient } from '../server/submissions.mjs';

// Preflight only. Never creates a post during a build.
if (process.env.VERCEL_ENV === 'production' && process.env.X_AUTO_REPLY_ENABLED === 'true') {
  const redis=redisClient(), key='digivated:private:x-publish:lock', lease=randomBytes(32).toString('hex');
  if(await redis(['SET',key,lease,'NX','EX',150])!=='OK') throw new Error('Publisher is busy; retry the deployment after its current run.');
  try {
    await credentials(process.env,redis);
    console.info('X publisher preflight verified @digivatedx and token access. No post sent.');
  } catch {
    throw new Error('X publisher preflight failed. Check X authorization, API access and credits; no post sent.');
  } finally {
    await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0",1,key,lease]);
  }
}
