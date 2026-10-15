import {test,expect} from '@playwright/test';
const service='https://cglkjclolglwizwepvmy.supabase.co';
const uid='e0000000-0000-4000-8000-000000000001';
const user={id:uid,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-10-15'};
const token=[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map(v=>typeof v==='string'?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
async function fixtures(page){
 await page.addInitScript(()=>localStorage.setItem('digivated-community-welcome','seen'));
 await page.route('**/api/community?action=config',r=>r.fulfill({json:{ready:true,url:service,key:'fixture',google:false}}));
 await page.route(`${service}/rest/v1/**`,r=>r.fulfill({json:new URL(r.request().url()).searchParams.get('id')?.startsWith('eq.')?null:[]}));
 await page.route(`${service}/auth/v1/**`,r=>r.fulfill({json:user}));
}
for(const width of [390,1440])test(`Account signup login and recovery ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await fixtures(page);
 let signup:any,resend:any,recovery:any;
 await page.route(`${service}/auth/v1/signup**`,r=>{signup={body:r.request().postDataJSON(),url:r.request().url()};return r.fulfill({json:{user:{...user,email_confirmed_at:null},session:null}});});
 await page.route(`${service}/auth/v1/resend**`,r=>{resend=r.request().postDataJSON();return r.fulfill({json:{}});});
 await page.route(`${service}/auth/v1/recover**`,r=>{recovery=r.request().url();return r.fulfill({json:{}});});
 await page.goto('http://127.0.0.1:4321/community');await page.getByRole('button',{name:'Join the community',exact:false}).click();
 await page.locator('#community-email input[name=email]').fill(user.email);await page.locator('#community-email input[name=password]').fill('test-only-password');
 await page.locator('#auth-submit').click();await expect(page.locator('#auth-check-email')).toBeVisible();
 expect(signup.body.code_challenge).toBeFalsy();expect(new URL(signup.url).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4321/community/settings');
 await page.locator('#auth-resend').click();await expect(page.locator('#community-auth-status')).toContainText('fresh email');expect(resend.type).toBe('signup');
 await page.screenshot({path:`test-results/community-auth-verify-${width}.png`,fullPage:true});
 await page.locator('[data-auth-mode=login]').click();await expect(page.locator('#auth-submit')).toHaveText('Log in');
 await page.locator('#auth-forgot').click();await expect(page.locator('#auth-password-label')).toBeHidden();await page.locator('#auth-submit').click();await expect(page.locator('#auth-email-instructions')).toContainText('reset link');expect(new URL(recovery).searchParams.get('redirect_to')).toContain('/community/settings');
 await page.locator('[data-auth-mode=signup]').click();await page.screenshot({path:`test-results/community-auth-signup-${width}.png`,fullPage:true});
});
test('Email confirmation establishes a session in a fresh browser without PKCE verifier',async({page})=>{
 await fixtures(page);
 await page.goto(`http://127.0.0.1:4321/community/settings#access_token=${token}&refresh_token=fixture&expires_in=3600&token_type=bearer&type=signup`);
 await expect(page.locator('[data-member-logout]')).toBeVisible();
 await expect(page.locator('#community-status')).toContainText('email is verified');
 expect(page.url()).not.toContain('access_token');
});
test('Password recovery opens new password form and expired link gives recovery path',async({page})=>{
 await fixtures(page);await page.goto(`http://127.0.0.1:4321/community/settings#access_token=${token}&refresh_token=fixture&expires_in=3600&token_type=bearer&type=recovery`);
 await expect(page.locator('#auth-title')).toHaveText('Choose a new password.');await expect(page.locator('#auth-email-label')).toBeHidden();
 await page.goto('http://127.0.0.1:4321/community');
 await page.goto('http://127.0.0.1:4321/community/settings#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
 await expect(page.locator('#community-auth-status')).toContainText('expired');await expect(page.locator('#auth-forgot')).toBeVisible();
});

test('Existing members log in with their password',async({page})=>{
 await fixtures(page);let credentials:any;
 await page.route(`${service}/auth/v1/token**`,r=>{credentials=r.request().postDataJSON();return r.fulfill({json:{access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user}});});
 await page.goto('http://127.0.0.1:4321/community');await page.getByRole('button',{name:'Join the community',exact:false}).click();await page.locator('[data-auth-mode=login]').click();
 await page.locator('#community-email input[name=email]').fill(user.email);await page.locator('#community-email input[name=password]').fill('fixture-password');await page.locator('#auth-submit').click();
 await expect(page).toHaveURL('http://127.0.0.1:4321/community/settings');await expect(page.locator('[data-member-logout]')).toBeVisible();expect(credentials.email).toBe(user.email);
});
