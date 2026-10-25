# Account email delivery

Digivated already requests signup and sign-in links through Supabase Auth. For public delivery, configure **custom SMTP** in the Digivated Supabase project's Authentication settings. Supabase's default mail service is restricted to team addresses and is not a production sender. Keep email confirmations enabled.

Use a verified Digivated sending domain and a transactional email provider such as Resend. In the provider, verify the domain and save its SMTP host, port, username, password, and sender address in Supabase Auth's Custom SMTP settings. Test signup and sign-in with a separate mailbox by opening the received links and checking the account page.

For project status and private feedback alerts, set these **production** environment variables on the Vercel project:

- `RESEND_API_KEY`: a send-only Resend API key, stored as a secret.
- `ACCOUNT_EMAIL_FROM`: a verified sender, for example `Digivated <updates@digivated.com>`.

Redeploy after adding the variables. The owner dashboard then emails verified account holders when a project's status or private feedback changes. The message links to `/account`; feedback text stays on the site. Saves remain successful if mail delivery fails, and the dashboard reports that the creator was not emailed. Only submissions tied to a verified account receive these alerts. Changes to a cover image, launch page, or project copy alone do not send an email.
