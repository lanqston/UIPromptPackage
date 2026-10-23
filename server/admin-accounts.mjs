import { createClient } from '@supabase/supabase-js';
import { AdminError } from './admin-auth.mjs';
import { memberConfig } from './member-community.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PAGE_SIZE = 50;

function authClient(env, injected) {
  if (injected) return injected;
  const cfg = memberConfig(env);
  if (!cfg || !env.COMMUNITY_SUPABASE_SECRET_KEY) throw new AdminError(503, 'Account management needs Supabase configuration.');
  return createClient(cfg.url, env.COMMUNITY_SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

function safeUser(user) {
  return {
    id: user.id,
    email: user.email || '',
    createdAt: user.created_at || null,
    lastSignInAt: user.last_sign_in_at || null,
    confirmedAt: user.email_confirmed_at || null,
    bannedUntil: user.banned_until || null,
    providers: Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers.filter(value => typeof value === 'string').slice(0, 5) : []
  };
}

export async function listAccounts(env, page, injected) {
  if (!Number.isInteger(page) || page < 1 || page > 2000) throw new AdminError(400, 'Invalid account page.');
  const { data, error } = await authClient(env, injected).auth.admin.listUsers({ page, perPage: PAGE_SIZE });
  if (error || !Array.isArray(data?.users)) throw new AdminError(503, 'Accounts could not be loaded. Try again shortly.');
  return { items: data.users.map(safeUser), next: data.users.length === PAGE_SIZE ? page + 1 : null };
}

export async function setAccountBan(env, id, operation, injected) {
  if (!UUID.test(id || '') || !['block', 'unblock'].includes(operation)) throw new AdminError(400, 'Invalid account action.');
  const client = authClient(env, injected);
  const { data: existing, error: lookupError } = await client.auth.admin.getUserById(id);
  if (lookupError || !existing?.user) throw new AdminError(404, 'Account not found. Refresh the list.');
  const { data, error } = await client.auth.admin.updateUserById(id, { ban_duration: operation === 'block' ? '876000h' : 'none' });
  if (error || !data?.user) throw new AdminError(503, 'Account status could not be changed. Refresh and try again.');
  return { user: safeUser(data.user) };
}
