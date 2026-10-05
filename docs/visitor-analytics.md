# Monthly visitors

The home page card reads `/api/visitors`. It shows unique users for the last 30 complete days and a daily unique-user trend. The total is requested separately to avoid double-counting repeat visitors across days. Reports use the property's timezone and are cached for one hour. Missing dates in a successful report are displayed as zero; missing configuration or failed reports never produce invented counts or a decorative trend.

To connect real data:

1. Create or use a Google Analytics 4 property collecting this site's traffic.
2. Enable Google Analytics Data API in the service account's Google Cloud project.
3. Grant that service account Viewer access in GA4 Property Access Management.
4. Add `GA4_PROPERTY_ID` (numeric property ID), `GA4_CLIENT_EMAIL`, and `GA4_PRIVATE_KEY` to the production Vercel environment and redeploy. The PEM key accepts real newlines or escaped `\n` characters.

The API returns aggregate counts only. Credentials stay on the server. This implementation reads GA4 reports; it does not install a tracking tag or begin collecting visitor data. A GA4 collection setup must already be connected to this site before reports can contain visits. Until configuration is supplied, the card displays an em dash and “Visitor analytics coming soon.” Google reporting may lag; it is not a realtime counter.
