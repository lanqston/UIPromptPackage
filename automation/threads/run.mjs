import {readFile, appendFile} from 'node:fs/promises';
import {matches, alreadyLogged, day, shortcode} from './matcher.mjs';

const config = JSON.parse(await readFile(new URL('./config.json', import.meta.url)));
const seed = JSON.parse(await readFile(new URL('./log.json', import.meta.url)));
const token = process.env.THREADS_ACCESS_TOKEN;
const ghToken = process.env.GH_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const live = process.env.THREADS_LIVE === 'true' && config.enabled;
const branch = 'promptcove-reply-log';
const logPath = 'automation/threads/log.json';
const report = [];

async function request(origin, path, auth, method = 'GET', body) {
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error('Unexpected API origin');
  const response = await fetch(url, {method, signal:AbortSignal.timeout(20000), headers:{
    Authorization:`Bearer ${auth}`, Accept:'application/json',
    ...(body ? {'Content-Type':'application/json'} : {}),
    ...(origin === 'https://api.github.com' ? {'X-GitHub-Api-Version':'2022-11-28'} : {})
  }, ...(body ? {body:JSON.stringify(body)} : {})});
  const json = await response.json();
  if (!response.ok || json.error) {
    // Never print API URLs, response bodies or tokens.
    const error = new Error(`API request failed (HTTP ${response.status}, code ${json.error?.code ?? 'unknown'})`);
    error.status = response.status; throw error;
  }
  return json;
}
const github = (path, method, body) => request('https://api.github.com', `/repos/${repo}/${path}`, ghToken, method, body);
async function meta(path, params = {}, method = 'GET') {
  const url = new URL(`/v1.0/${path}`, 'https://graph.threads.net');
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return request('https://graph.threads.net', url.pathname+url.search, token, method);
}
async function allPages(path, params) {
  let result = await meta(path, {...params,limit:100});
  const items = [];
  for (let page=0; page<20; page++) {
    if (!Array.isArray(result.data)) throw new Error('Incomplete reply/search response');
    items.push(...result.data);
    if (!result.paging?.next) return items;
    const next = new URL(result.paging.next);
    if (next.origin !== 'https://graph.threads.net' || !next.searchParams.get('after')) throw new Error('Unverifiable pagination');
    result = await meta(path, {...params,limit:100,after:next.searchParams.get('after')});
  }
  throw new Error('Reply history exceeds verification limit; skipping');
}
async function loadLog() {
  try {
    const file = await github(`contents/${logPath}?ref=${branch}`);
    const log = JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
    if (log.version !== 1 || !Array.isArray(log.entries)) throw new Error('Invalid persistent log');
    return {log,sha:file.sha};
  } catch(error) {
    if (error.status !== 404) throw error;
    // Never reset a missing log on an existing branch.
    let exists = true;
    try { await github(`git/ref/heads/${branch}`); } catch(e) { if (e.status===404) exists=false; else throw e; }
    if (exists) throw new Error('Persistent log missing on existing branch; refusing to post');
    if (!live) return {log:seed,sha:null};
    const head = await github('git/ref/heads/main');
    await github('git/refs','POST',{ref:`refs/heads/${branch}`,sha:head.object.sha});
    // Branch now contains the seed file from main.
    return loadLog();
  }
}
async function saveLog(state) {
  const response = await github(`contents/${logPath}`,'PUT',{
    message:'Record PromptCove reply state',branch,sha:state.sha,
    content:Buffer.from(JSON.stringify(state.log,null,2)+'\n').toString('base64')
  });
  state.sha = response.content.sha;
}

try {
  if (!token || !ghToken || !repo) throw new Error('Setup required: Threads API token and GitHub repository access');
  const account = await meta('me',{fields:'id,username'});
  if (account.username?.toLowerCase() !== config.username) throw new Error('Connected Threads account is not @promptcove');
  report.push(`Account verified: @${config.username}. Mode: ${live ? 'LIVE' : 'preview (no replies)'}.`);
  const state = await loadLog();
  const today = day();
  // Reservations count toward the daily cap even after crashes or ambiguous publish results.
  const used = state.log.entries.filter(e=>e.date===today && ['reserved','posted','uncertain'].includes(e.state)).length;
  if (used >= config.maxPerDay) { report.push('Daily limit reached.'); }
  else {
    const candidates = new Map();
    const fields='id,text,username,timestamp,permalink,topic_tag,is_reply,is_quote_post';
    for (const query of config.queries) {
      const posts = await meta('keyword_search',{q:query,search_type:'RECENT',fields,limit:25});
      if (!Array.isArray(posts.data)) throw new Error('Public search returned an invalid response');
      for (const post of posts.data) if(matches(post,config) && !alreadyLogged(post,state.log.entries)) candidates.set(post.id,post);
    }
    let sent=0;
    for (const post of [...candidates.values()].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))) {
      if (sent>=Math.min(config.maxPerRun, config.maxPerDay-used)) break;
      // This endpoint may be unavailable for other accounts' posts. Never assume empty replies.
      let replies;
      try { replies = await allPages(`${post.id}/conversation`,{fields:'id,username,text,is_reply,is_reply_owned_by_me'}); }
      catch { report.push(`Skipped ${post.permalink}: previous replies could not be verified.`); continue; }
      if (replies.some(r=>!r.username || !r.id)) { report.push(`Skipped ${post.permalink}: incomplete reply identity.`); continue; }
      // More conservative than promotion-only: any previous reply from this account blocks another.
      if (replies.some(r=>r.username?.toLowerCase()===config.username || r.is_reply_owned_by_me===true)) {
        report.push(`Skipped ${post.permalink}: @promptcove already replied.`); continue;
      }
      if (!live) { report.push(`Eligible (preview only): ${post.permalink}`); continue; }
      const entry={postId:post.id,postUrl:post.permalink,shortcode:shortcode(post.permalink),state:'reserved',date:today,reservedAt:new Date().toISOString()};
      state.log.entries.push(entry);
      // Commit before sending. A crash or timeout never causes automatic retries.
      await saveLog(state);
      sent++;
      try {
        const container = await meta(`${account.id}/threads`,{media_type:'TEXT',text:config.comment,reply_to_id:post.id},'POST');
        if (!container.id) throw new Error('Container ID missing');
        entry.containerId=container.id;
        await saveLog(state);
        const published = await meta(`${account.id}/threads_publish`,{creation_id:container.id},'POST');
        if (!published.id) throw new Error('Publish ID missing');
        entry.replyId=published.id;
        const verified=await meta(published.id,{fields:'id,username,permalink,text,is_reply,replied_to'});
        if (verified.username?.toLowerCase()!==config.username || verified.is_reply!==true || verified.replied_to?.id!==post.id || verified.text!==config.comment) throw new Error('Published reply could not be verified');
        entry.state='posted'; entry.replyUrl=verified.permalink; entry.postedAt=new Date().toISOString();
        await saveLog(state);
        report.push(`Replied: ${post.permalink}\nReply: ${entry.replyUrl}`);
      } catch(error) {
        entry.state='uncertain'; await saveLog(state);
        throw new Error('Reply outcome needs manual review. Reserved post will not be retried.');
      }
    }
    if (!candidates.size) report.push('No eligible invitations found. Public-search permission still needs separate validation if results are empty.');
  }
} catch(error) {
  report.push(`Stopped: ${error.message}`); process.exitCode=1;
} finally {
  const summary=report.join('\n\n')+'\n';
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
}
