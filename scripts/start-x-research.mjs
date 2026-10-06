import { redisClient } from '../server/submissions.mjs';
import { runResearch, makeAgent } from '../server/x-research.mjs';

// Explicit operator-requested research attempt, once per deployment request ID.
// Uses server-side credentials and never invokes the publisher.
const requestId = process.env.X_RESEARCH_RUN_ON_DEPLOY;
if (process.env.VERCEL_ENV === 'production' && /^[a-z0-9-]{1,80}$/.test(requestId || '')) {
  const redis = redisClient();
  const prefix = 'digivated:private:x-research:';
  if (await redis(['SET', prefix + 'operator-run:' + requestId, 'started', 'NX']) === 'OK') {
    const period = new Date().toISOString().slice(0,13);
    // A user-requested retry may release only a completed failure or empty result in this hour.
    const releaseFailure = `local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local r=cjson.decode(raw); if (r.status=='failed' or (r.status=='completed' and r.added==0)) and r.period==ARGV[1] then return redis.call('DEL',KEYS[2]) end; return 0`;
    await redis(['EVAL', releaseFailure, 2, prefix+'latest', prefix+'run:'+period, period]);
    const report = await runResearch(redis, makeAgent(process.env, redis));
    console.info(JSON.stringify({event:'operator_x_research', status:report.status, added:report.added || 0, error:report.error || null}));
  }
}
