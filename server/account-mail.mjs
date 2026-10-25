const labels = { approved: 'approved and is now public', featured: 'featured', rejected: 'reviewed and not approved', archived: 'archived', pending: 'back in review' };

export function projectUpdate(previous, record) {
  if (!record?.accountId || !record.email || !previous) return null;
  const statusChanged = previous.status !== record.status;
  const feedbackChanged = (previous.reviewFeedback || '') !== (record.reviewFeedback || '');
  if (!statusChanged && !feedbackChanged) return null;
  const update = statusChanged ? `Your project was ${labels[record.status] || 'updated'}.` : 'You have new private feedback on your project.';
  return {
    to: record.email,
    subject: 'Your Digivated project has an update',
    text: `Hello,\n\n${update}\n\nSign in to see your project status and any private feedback: https://digivated.com/account\n\nDigivated`,
    idempotencyKey: `digivated-project-${record.id}-r${record.revision}`,
  };
}

export async function sendProjectUpdate(previous, record, env = process.env, fetcher = fetch, accountClient) {
  const update = projectUpdate(previous, record);
  if (!update) return 'skipped';
  if (!env.RESEND_API_KEY || !env.ACCOUNT_EMAIL_FROM) return 'unavailable';
  try {
    if (!accountClient && (!env.COMMUNITY_SUPABASE_URL || !env.COMMUNITY_SUPABASE_SECRET_KEY)) return 'unavailable';
    const client = accountClient || createClient(env.COMMUNITY_SUPABASE_URL, env.COMMUNITY_SUPABASE_SECRET_KEY, {auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
    const {data,error} = await client.auth.admin.getUserById(record.accountId);
    if (error || !data?.user?.email_confirmed_at || data.user.email?.trim().toLowerCase() !== update.to.trim().toLowerCase()) return 'failed';
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': update.idempotencyKey },
      body: JSON.stringify({ from: env.ACCOUNT_EMAIL_FROM, to: [update.to], subject: update.subject, text: update.text }),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    return response.ok ? 'sent' : 'failed';
  } catch { return 'failed'; }
}
import { createClient } from '@supabase/supabase-js';

