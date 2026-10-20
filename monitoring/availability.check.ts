import { ApiCheck, AssertionBuilder, Frequency } from 'checkly/constructs';

// A connection failure must be detectable independently of browser UI checks.
new ApiCheck('digivated-https-availability', {
  name: 'Digivated HTTPS availability',
  activated: true,
  muted: false,
  frequency: Frequency.EVERY_5M,
  locations: ['us-east-1', 'us-west-1'],
  degradedResponseTime: 5000,
  maxResponseTime: 15000,
  request: {
    method: 'GET',
    url: 'https://digivated.com/',
    followRedirects: false,
    skipSSL: false,
    headers: [{ key: 'User-Agent', value: 'Digivated-uptime-monitor' }],
    assertions: [AssertionBuilder.statusCode().equals(200)],
  },
});
