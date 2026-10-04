import { spawnSync } from 'node:child_process';

// Vercel owns the credentials. Never write them to files or send them to browsers.
if (process.env.VERCEL_ENV !== 'production') {
  console.info('Checkly: deployment skipped outside production.');
  process.exit(0);
}
const apiKey = process.env.CHECKLY_API_KEY || process.env.PromptCoveCheckly_CHECKLY_API_KEY;
const accountId = process.env.CHECKLY_ACCOUNT_ID || process.env.PromptCoveCheckly_CHECKLY_ACCOUNT_ID;
if (!apiKey || !accountId) throw new Error('Checkly credentials are missing from the production environment.');

const ids = [];
for (let page = 1; ; page++) {
  const response = await fetch(`https://api.checklyhq.com/v1/alert-channels?limit=100&page=${page}`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'X-Checkly-Account': accountId },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Checkly alert-channel lookup failed (${response.status}).`);
  const channels = await response.json();
  if (!Array.isArray(channels)) throw new Error('Unexpected Checkly alert-channel response.');
  // Reuse existing email destinations; do not create recipients or alter other channels.
  ids.push(...channels.filter(channel => channel.type === 'EMAIL' && channel.sendFailure !== false).map(channel => channel.id));
  if (channels.length < 100) break;
}
if (!ids.length) console.warn('Checkly: no existing email alert channel; configure one in the Checkly dashboard.');
const env = { ...process.env, CHECKLY_API_KEY: apiKey, CHECKLY_ACCOUNT_ID: accountId, CHECKLY_ALERT_CHANNEL_IDS: ids.join(',') };
for (const args of [['deploy', '--force', '--preserve-resources'], ['test', '--reporter=ci', '--timeout=180']]) {
  const result = spawnSync('node_modules/.bin/checkly', args, { env, stdio: 'inherit', timeout: 240000 });
  if (result.error || result.status !== 0) {
    if (args[0] === 'deploy') throw new Error('Checkly deployment failed. See the preceding output.');
    // The live site may be awaiting this deployment; never block a repair on its old state.
    console.warn('Checkly: the live-site test failed; inspect the recorded test session after deployment.');
    process.exit(0);
  }
}
console.info(`Checkly: production monitor deployed and tested; ${ids.length} existing email alert channel(s) attached.`);
