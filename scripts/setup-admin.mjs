// Local-only setup helper. Reads a password through stdin, never command arguments.
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { passwordHash } from '../server/admin-auth.mjs';
let password = '';
for await (const chunk of process.stdin) { password += chunk; if (password.length > 202) throw new Error('Password too long.'); }
password = password.replace(/\r?\n$/, '');
const hash = await passwordHash(password);
await mkdir('.private', { recursive: true });
const filename = `.private/admin-setup-${Date.now()}.env`;
await writeFile(filename, `DIGIVATED_ADMIN_PASSWORD_HASH=${hash}\nDIGIVATED_ADMIN_SESSION_SECRET=${randomBytes(32).toString('hex')}\n`, { mode: 0o600, flag: 'wx' });
console.log(`Admin settings written to ${filename}. Add them to Vercel as server-only values. Keep your password in your password manager; do not commit this file.`);
