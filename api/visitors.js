import { getVisitorReport } from '../server/visitors.mjs';
let cached;
let inFlight;
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ status: 'unavailable' }); }
  try {
    if (!cached || Date.now() - cached.at > 3600000) {
      inFlight ||= getVisitorReport().finally(() => { inFlight = undefined; });
      const value = await inFlight;
      cached = { at: Date.now(), value };
    }
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return res.status(200).json(cached.value);
  } catch (error) {
    const code = error.reportingCode || (error.name === 'TimeoutError' ? 'TIMEOUT' : 'REPORTING_FAILED');
    console.error('visitor_reporting_error', code);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ status: 'unavailable' });
  }
}
