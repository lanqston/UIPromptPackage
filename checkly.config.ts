import { defineConfig } from 'checkly';
import { AlertChannel, Frequency } from 'checkly/constructs';

const alertChannels = (process.env.CHECKLY_ALERT_CHANNEL_IDS || '')
  .split(',').filter(Boolean).map(id => AlertChannel.fromId(Number(id)));

export default defineConfig({
  projectName: 'PromptCove',
  logicalId: 'promptcove-production',
  repoUrl: 'https://github.com/lanqston/UIPromptPackage',
  checks: {
    activated: true,
    muted: false,
    frequency: Frequency.EVERY_1H,
    locations: ['us-east-1'],
    tags: ['promptcove', 'production'],
    alertChannels,
    browserChecks: { testMatch: './monitoring/*.spec.ts' },
  },
});
