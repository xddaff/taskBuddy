import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Next.js only reads .env files from the app directory, but web, realtime and
// worker are meant to share one configuration file at the repo root. Loading it
// here runs before the rest of the config and before compilation, so both
// server code and NEXT_PUBLIC_ inlining see it.
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv, quiet: true });
}

const nextConfig: NextConfig = {
  agentRules: false,
  // The shared packages ship TypeScript source rather than build output, so
  // Next has to compile them as part of the app.
  transpilePackages: [
    '@studentproj/db',
    '@studentproj/gitlab',
    '@studentproj/indexer',
    '@studentproj/scoring',
  ],
  experimental: {
    // Server Actions receive uploads for chat attachments.
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
