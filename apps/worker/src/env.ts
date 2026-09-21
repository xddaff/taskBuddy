import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The worker runs from apps/worker but the env file lives at the repo root, so
// that web, realtime and worker all read one configuration.
const repoRootEnv = resolve(import.meta.dirname, '../../../.env');
if (existsSync(repoRootEnv)) {
  config({ path: repoRootEnv, quiet: true });
} else {
  config({ quiet: true });
}

export const env = {
  gitlabBaseUrl: process.env.GITLAB_BASE_URL ?? 'https://gitlab.com',
  gitlabIndexToken: process.env.GITLAB_INDEX_TOKEN ?? '',
  gitlabIndexGroups: process.env.GITLAB_INDEX_GROUPS ?? '',
  /// Minutes between scheduled crawls when running in `serve` mode.
  crawlIntervalMinutes: Number.parseInt(process.env.CRAWL_INTERVAL_MINUTES ?? '30', 10),
  recommendIntervalMinutes: Number.parseInt(
    process.env.RECOMMEND_INTERVAL_MINUTES ?? '15',
    10,
  ),
};
