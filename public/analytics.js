// Public GA4 measurement ID. Run only on the public production hostname.
(() => {
  if (window.location.hostname !== 'digivated.vercel.app') return;
  if (document.querySelector('script[data-digivated-analytics]')) return;
  const measurementId = 'G-BRXWQ313J5';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const safeUrl = value => {
    try { const url = new URL(value); return url.origin + url.pathname; }
    catch { return ''; }
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_location: safeUrl(window.location.href),
    page_referrer: safeUrl(document.referrer),
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  tag.dataset.digivatedAnalytics = measurementId;
  tag.onload = () => { tag.dataset.loaded = 'true'; };
  document.head.appendChild(tag);
})();
