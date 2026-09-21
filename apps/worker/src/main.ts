import { prisma } from '@studentproj/db';
import { crawlGroups, parseGroupList, refreshAllRecommendations, syncTaxonomy } from '@studentproj/indexer';
import { env } from './env.js';

const log = (message: string) => console.log(`[worker] ${message}`);

async function runCrawl(): Promise<void> {
  const groups = parseGroupList(env.gitlabIndexGroups);

  // Without a token or groups there is nothing to crawl. This is the normal
  // state on a fresh checkout, so say what to do rather than failing.
  if (!env.gitlabIndexToken || groups.length === 0) {
    log(
      'Skipping crawl: set GITLAB_INDEX_TOKEN and GITLAB_INDEX_GROUPS to index a real instance. ' +
        'Run `pnpm db:seed` for demo data in the meantime.',
    );
    await syncTaxonomy();
    return;
  }

  log(`Crawling ${groups.length} group(s) on ${env.gitlabBaseUrl}...`);
  const result = await crawlGroups({
    baseUrl: env.gitlabBaseUrl,
    token: env.gitlabIndexToken,
    groups,
    onProgress: log,
  });

  log(`Indexed ${result.projectsIndexed} projects and ${result.issuesIndexed} open issues.`);
  for (const error of result.errors) {
    log(`  warning: ${error}`);
  }
}

async function runRecommend(): Promise<void> {
  log('Refreshing recommendations...');
  const results = await refreshAllRecommendations(log);
  const scored = results.reduce((sum, result) => sum + result.scored, 0);
  log(`Refreshed ${results.length} profile(s), ${scored} recommendations.`);
}

/// Long-running mode: crawl and rescore on a timer.
///
/// Polling rather than webhooks is the primary path because the app runs on
/// localhost for the demo, where GitLab cannot reach it. The webhook receiver
/// in apps/web is an accelerator for when it is reachable, not a requirement.
async function serve(): Promise<void> {
  log(
    `Serving. Crawl every ${env.crawlIntervalMinutes}min, rescore every ${env.recommendIntervalMinutes}min.`,
  );

  const safely = async (name: string, task: () => Promise<void>) => {
    try {
      await task();
    } catch (error) {
      // A scheduled job must never take the worker down; the next tick retries.
      log(`${name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await safely('crawl', runCrawl);
  await safely('recommend', runRecommend);

  setInterval(() => void safely('crawl', runCrawl), env.crawlIntervalMinutes * 60_000);
  setInterval(() => void safely('recommend', runRecommend), env.recommendIntervalMinutes * 60_000);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'serve';

  switch (command) {
    case 'index':
      await runCrawl();
      break;
    case 'recommend':
      await runRecommend();
      break;
    case 'serve':
      await serve();
      return; // stays alive on its timers
    default:
      console.error(`Unknown command "${command}". Expected index, recommend or serve.`);
      process.exitCode = 1;
  }

  await prisma.$disconnect();
}

void main().catch(async (error) => {
  console.error('[worker] fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
