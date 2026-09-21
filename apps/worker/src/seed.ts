/// Demo data for local development and presentations.
///
/// A live GitLab crawl is slow and depends on the network holding up, which is
/// exactly what you do not want when demoing. This script stands in for it
/// completely, and it deliberately routes its fixture issues through the real
/// indexer so the tags, scores and reasons on screen are produced by the same
/// code path a real crawl would use.

import './env';
import { prisma, type Commitment, type Experience } from '@studentproj/db';
import type { GitlabIssue, GitlabProject } from '@studentproj/gitlab';
import { refreshAllRecommendations, syncTaxonomy, upsertProjectWithIssues } from '@studentproj/indexer';

const log = (message: string) => console.log(`[seed] ${message}`);

const NOW = Date.now();
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000);
const hours = (count: number) => count * 3600;

// ---------------------------------------------------------------------------
// Fixture GitLab projects
// ---------------------------------------------------------------------------

interface ProjectFixture {
  project: GitlabProject;
  languages: Record<string, number>;
  issues: Array<Partial<GitlabIssue> & { title: string; iid: number }>;
}

let nextIssueId = 90_000;

function issue(
  input: Partial<GitlabIssue> & { title: string; iid: number },
  projectId: number,
  projectPath: string,
): GitlabIssue {
  return {
    id: nextIssueId++,
    iid: input.iid,
    project_id: projectId,
    title: input.title,
    description: input.description ?? null,
    state: input.state ?? 'opened',
    web_url: `https://gitlab.com/${projectPath}/-/issues/${input.iid}`,
    labels: input.labels ?? [],
    weight: input.weight ?? null,
    time_stats: input.time_stats ?? { time_estimate: 0, total_time_spent: 0 },
    assignees: input.assignees ?? [],
    author: input.author ?? { id: 1, username: 'maintainer' },
    created_at: (input.created_at as string) ?? daysAgo(40).toISOString(),
    updated_at: (input.updated_at as string) ?? daysAgo(3).toISOString(),
  };
}

const PROJECT_FIXTURES: ProjectFixture[] = [
  {
    project: {
      id: 501,
      name: 'Campus Events',
      path_with_namespace: 'cs-department/campus-events',
      description: 'Event listing and RSVP app used by student societies.',
      web_url: 'https://gitlab.com/cs-department/campus-events',
      avatar_url: null,
      star_count: 24,
      last_activity_at: daysAgo(1).toISOString(),
    },
    languages: { TypeScript: 68.4, CSS: 22.1, JavaScript: 8.3, Shell: 1.2 },
    issues: [
      {
        iid: 12,
        title: 'Add keyboard navigation to the event filter sidebar',
        description: 'The filter panel traps focus and cannot be operated without a mouse.',
        labels: ['frontend', 'accessibility', 'good first issue'],
        weight: 2,
        time_stats: { time_estimate: hours(6), total_time_spent: 0 },
        updated_at: daysAgo(1).toISOString(),
      },
      {
        iid: 14,
        title: 'Event card layout breaks on narrow screens',
        labels: ['frontend', 'css', 'bug'],
        weight: 1,
        time_stats: { time_estimate: hours(3), total_time_spent: 0 },
        updated_at: daysAgo(2).toISOString(),
      },
      {
        iid: 18,
        title: 'Migrate RSVP endpoints to the new REST API shape',
        labels: ['backend', 'rest-api'],
        weight: 4,
        time_stats: { time_estimate: hours(14), total_time_spent: 0 },
        updated_at: daysAgo(5).toISOString(),
      },
      {
        iid: 21,
        title: 'Docker compose setup fails on first run',
        description: 'The web container starts before postgres is accepting connections.',
        labels: ['devops', 'docker', 'good first issue'],
        weight: 2,
        time_stats: { time_estimate: hours(4), total_time_spent: 0 },
        updated_at: daysAgo(1).toISOString(),
      },
      {
        iid: 25,
        title: 'Add end-to-end tests for the RSVP flow',
        labels: ['testing', 'frontend'],
        weight: 3,
        time_stats: { time_estimate: hours(10), total_time_spent: 0 },
        updated_at: daysAgo(8).toISOString(),
      },
      {
        iid: 27,
        title: 'Rewrite the scheduling engine for recurring events',
        labels: ['backend', 'architecture', 'complex'],
        weight: 8,
        time_stats: { time_estimate: hours(60), total_time_spent: 0 },
        updated_at: daysAgo(12).toISOString(),
      },
      {
        iid: 30,
        title: 'Tidy up the README and contribution guide',
        labels: ['documentation', 'good first issue'],
        weight: 1,
        time_stats: { time_estimate: hours(2), total_time_spent: 0 },
        updated_at: daysAgo(4).toISOString(),
      },
      {
        iid: 31,
        title: 'Slow query on the events list page',
        labels: ['backend', 'performance', 'postgres'],
        weight: 3,
        time_stats: { time_estimate: hours(8), total_time_spent: 0 },
        assignees: [{ id: 9, username: 'someone-else' }],
        updated_at: daysAgo(6).toISOString(),
      },
    ],
  },
  {
    project: {
      id: 502,
      name: 'Lecture Notes ML',
      path_with_namespace: 'cs-department/lecture-notes-ml',
      description: 'Summarises recorded lectures into searchable notes.',
      web_url: 'https://gitlab.com/cs-department/lecture-notes-ml',
      avatar_url: null,
      star_count: 41,
      last_activity_at: daysAgo(2).toISOString(),
    },
    languages: { Python: 88.2, Jupyter: 7.4, Shell: 4.4 },
    issues: [
      {
        iid: 4,
        title: 'Improve transcript sentence segmentation for NLP pipeline',
        labels: ['machine-learning', 'nlp', 'python'],
        weight: 5,
        time_stats: { time_estimate: hours(20), total_time_spent: 0 },
        updated_at: daysAgo(2).toISOString(),
      },
      {
        iid: 6,
        title: 'Add unit tests for the summarisation scorer',
        labels: ['testing', 'python', 'good first issue'],
        weight: 2,
        time_stats: { time_estimate: hours(5), total_time_spent: 0 },
        updated_at: daysAgo(3).toISOString(),
      },
      {
        iid: 9,
        title: 'FastAPI endpoint for on-demand summarisation',
        labels: ['backend', 'fastapi', 'rest-api'],
        weight: 3,
        time_stats: { time_estimate: hours(12), total_time_spent: 0 },
        updated_at: daysAgo(1).toISOString(),
      },
      {
        iid: 11,
        title: 'Dockerise the training job',
        labels: ['devops', 'docker'],
        weight: 3,
        time_stats: { time_estimate: hours(9), total_time_spent: 0 },
        updated_at: daysAgo(2).toISOString(),
      },
      {
        iid: 13,
        title: 'Visualise model accuracy over training epochs',
        labels: ['data-viz', 'python'],
        weight: 2,
        time_stats: { time_estimate: hours(6), total_time_spent: 0 },
        updated_at: daysAgo(15).toISOString(),
      },
      {
        iid: 15,
        title: 'Investigate GPU memory leak during long runs',
        labels: ['machine-learning', 'hard'],
        weight: 8,
        updated_at: daysAgo(30).toISOString(),
      },
    ],
  },
  {
    project: {
      id: 503,
      name: 'Campus Map Mobile',
      path_with_namespace: 'cs-department/campus-map-mobile',
      description: 'Flutter app for navigating campus buildings.',
      web_url: 'https://gitlab.com/cs-department/campus-map-mobile',
      avatar_url: null,
      star_count: 12,
      last_activity_at: daysAgo(6).toISOString(),
    },
    languages: { Dart: 91.5, Swift: 4.2, Kotlin: 4.3 },
    issues: [
      {
        iid: 3,
        title: 'Offline tile caching for building maps',
        labels: ['mobile', 'flutter', 'performance'],
        weight: 5,
        time_stats: { time_estimate: hours(18), total_time_spent: 0 },
        updated_at: daysAgo(6).toISOString(),
      },
      {
        iid: 5,
        title: 'Accessibility labels missing on map markers',
        labels: ['mobile', 'accessibility', 'good first issue'],
        weight: 2,
        time_stats: { time_estimate: hours(4), total_time_spent: 0 },
        updated_at: daysAgo(7).toISOString(),
      },
      {
        iid: 8,
        title: 'Set up GitLab CI for Flutter builds',
        labels: ['devops', 'ci-cd', 'flutter'],
        weight: 3,
        time_stats: { time_estimate: hours(10), total_time_spent: 0 },
        updated_at: daysAgo(9).toISOString(),
      },
    ],
  },
  {
    project: {
      id: 504,
      name: 'Grade Portal API',
      path_with_namespace: 'cs-department/grade-portal-api',
      description: 'Spring Boot service backing the student grade portal.',
      web_url: 'https://gitlab.com/cs-department/grade-portal-api',
      avatar_url: null,
      star_count: 8,
      last_activity_at: daysAgo(14).toISOString(),
    },
    languages: { Java: 94.1, SQL: 5.9 },
    issues: [
      {
        iid: 22,
        title: 'Harden authentication against session fixation',
        labels: ['security', 'backend', 'java'],
        weight: 5,
        time_stats: { time_estimate: hours(16), total_time_spent: 0 },
        updated_at: daysAgo(14).toISOString(),
      },
      {
        iid: 24,
        title: 'Add database migration for the new grade audit table',
        labels: ['backend', 'sql', 'postgres'],
        weight: 3,
        time_stats: { time_estimate: hours(8), total_time_spent: 0 },
        updated_at: daysAgo(18).toISOString(),
      },
      {
        iid: 26,
        title: 'Document the grading API endpoints',
        labels: ['documentation', 'good first issue'],
        weight: 1,
        time_stats: { time_estimate: hours(3), total_time_spent: 0 },
        updated_at: daysAgo(20).toISOString(),
      },
    ],
  },
  {
    project: {
      id: 505,
      name: 'Society Website',
      path_with_namespace: 'societies/society-website',
      description: 'Shared website template for student societies.',
      web_url: 'https://gitlab.com/societies/society-website',
      avatar_url: null,
      star_count: 3,
      // Deliberately dormant, so the freshness and project health factors
      // have something to push down the feed.
      last_activity_at: daysAgo(220).toISOString(),
    },
    languages: { JavaScript: 61.2, CSS: 33.5, HTML: 5.3 },
    issues: [
      {
        iid: 2,
        title: 'Replace jQuery carousel with a React component',
        labels: ['frontend', 'react', 'refactoring'],
        weight: 4,
        time_stats: { time_estimate: hours(12), total_time_spent: 0 },
        created_at: daysAgo(400).toISOString(),
        updated_at: daysAgo(210).toISOString(),
      },
      {
        iid: 7,
        title: 'Dark mode for the society theme',
        labels: ['frontend', 'css'],
        weight: 2,
        time_stats: { time_estimate: hours(6), total_time_spent: 0 },
        created_at: daysAgo(380).toISOString(),
        updated_at: daysAgo(240).toISOString(),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Fixture students
// ---------------------------------------------------------------------------

interface StudentFixture {
  username: string;
  name: string;
  email: string;
  weeklyHours: number;
  commitment: Commitment;
  experience: Experience;
  bio: string;
  skills: Array<[string, number]>;
  interests: string[];
}

const STUDENT_FIXTURES: StudentFixture[] = [
  {
    username: 'ilya',
    name: 'Ilya Petrov',
    email: 'ilya@students.example.edu',
    weeklyHours: 8,
    commitment: 'MODERATE',
    experience: 'INTERMEDIATE',
    bio: 'Second year, mostly frontend. Trying to get better at accessibility.',
    skills: [
      ['typescript', 4],
      ['react', 4],
      ['css', 3],
      ['nextjs', 3],
    ],
    interests: ['accessibility', 'frontend', 'ux-design'],
  },
  {
    username: 'maya',
    name: 'Maya Okafor',
    email: 'maya@students.example.edu',
    weeklyHours: 12,
    commitment: 'SERIOUS',
    experience: 'ADVANCED',
    bio: 'Final year, ML focus. Looking for something substantial for my thesis.',
    skills: [
      ['python', 5],
      ['machine-learning', 4],
      ['nlp', 4],
      ['docker', 3],
    ],
    interests: ['machine-learning', 'data-science', 'nlp'],
  },
  {
    username: 'tom',
    name: 'Tom Lindqvist',
    email: 'tom@students.example.edu',
    weeklyHours: 4,
    commitment: 'CASUAL',
    experience: 'BEGINNER',
    bio: 'First year. Want something small to start with.',
    skills: [
      ['python', 2],
      ['html', 2],
      ['git', 2],
    ],
    interests: ['documentation', 'testing'],
  },
  {
    username: 'sara',
    name: 'Sara Haddad',
    email: 'sara@students.example.edu',
    weeklyHours: 10,
    commitment: 'MODERATE',
    experience: 'INTERMEDIATE',
    bio: 'Interested in infrastructure and making builds not hurt.',
    skills: [
      ['docker', 4],
      ['ci-cd', 4],
      ['shell', 3],
      ['kubernetes', 2],
      ['postgres', 3],
    ],
    interests: ['devops', 'performance'],
  },
  {
    username: 'devin',
    name: 'Devin Cross',
    email: 'devin@students.example.edu',
    weeklyHours: 6,
    commitment: 'MODERATE',
    experience: 'INTERMEDIATE',
    bio: 'Mobile developer, Flutter mostly.',
    skills: [
      ['dart', 4],
      ['flutter', 4],
      ['mobile', 4],
      ['kotlin', 2],
    ],
    interests: ['mobile', 'ux-design'],
  },
  {
    username: 'priya',
    name: 'Priya Raman',
    email: 'priya@students.example.edu',
    weeklyHours: 9,
    commitment: 'MODERATE',
    experience: 'ADVANCED',
    bio: 'Backend and security. Java and Go.',
    skills: [
      ['java', 4],
      ['go', 3],
      ['security', 4],
      ['postgres', 3],
      ['spring', 3],
    ],
    interests: ['security', 'backend'],
  },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function seedTaxonomy(): Promise<void> {
  const count = await syncTaxonomy();
  log(`Taxonomy: ${count} tags.`);
}

async function seedProjects(): Promise<void> {
  for (const fixture of PROJECT_FIXTURES) {
    const openIssues = fixture.issues.map((input) =>
      issue(input, fixture.project.id, fixture.project.path_with_namespace),
    );
    const { issueCount } = await upsertProjectWithIssues({
      project: fixture.project,
      languages: fixture.languages,
      openIssues,
    });
    log(`Project ${fixture.project.path_with_namespace}: ${issueCount} issues.`);
  }
}

async function seedStudents(): Promise<Map<string, string>> {
  const userIds = new Map<string, string>();
  const tags = await prisma.tag.findMany({ select: { id: true, slug: true } });
  const tagId = new Map(tags.map((tag) => [tag.slug, tag.id]));

  for (const [index, fixture] of STUDENT_FIXTURES.entries()) {
    const user = await prisma.user.upsert({
      where: { gitlabUsername: fixture.username },
      create: {
        name: fixture.name,
        email: fixture.email,
        gitlabUserId: 1000 + index,
        gitlabUsername: fixture.username,
        image: `https://www.gravatar.com/avatar/${index}?d=identicon`,
      },
      update: { name: fixture.name, email: fixture.email },
    });
    userIds.set(fixture.username, user.id);

    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        weeklyHours: fixture.weeklyHours,
        commitment: fixture.commitment,
        experience: fixture.experience,
        bio: fixture.bio,
        onboardedAt: new Date(),
      },
      update: {
        weeklyHours: fixture.weeklyHours,
        commitment: fixture.commitment,
        experience: fixture.experience,
        bio: fixture.bio,
        onboardedAt: new Date(),
      },
    });

    await prisma.profileSkill.deleteMany({ where: { profileId: profile.id } });
    await prisma.profileSkill.createMany({
      data: fixture.skills
        .filter(([slug]) => tagId.has(slug))
        .map(([slug, proficiency]) => ({
          profileId: profile.id,
          tagId: tagId.get(slug)!,
          proficiency,
        })),
      skipDuplicates: true,
    });

    await prisma.profileInterest.deleteMany({ where: { profileId: profile.id } });
    await prisma.profileInterest.createMany({
      data: fixture.interests
        .filter((slug) => tagId.has(slug))
        .map((slug) => ({ profileId: profile.id, tagId: tagId.get(slug)! })),
      skipDuplicates: true,
    });

    log(`Student ${fixture.username}: ${fixture.skills.length} skills.`);
  }

  return userIds;
}

async function seedWorkspace(userIds: Map<string, string>): Promise<void> {
  const ilya = userIds.get('ilya')!;
  const sara = userIds.get('sara')!;
  const tom = userIds.get('tom')!;
  const maya = userIds.get('maya')!;

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'campus-events' },
    create: {
      name: 'Campus Events Team',
      slug: 'campus-events',
      description: 'Group project: event listing and RSVP app.',
      createdById: ilya,
      gitlabProjectIds: [501],
    },
    update: { gitlabProjectIds: [501] },
  });

  const memberships: Array<[string, 'OWNER' | 'ADMIN' | 'MEMBER']> = [
    [ilya, 'OWNER'],
    [sara, 'ADMIN'],
    [tom, 'MEMBER'],
    [maya, 'MEMBER'],
  ];
  for (const [userId, role] of memberships) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
      create: { workspaceId: workspace.id, userId, role },
      update: { role },
    });
  }
  log(`Workspace ${workspace.slug}: ${memberships.length} members.`);

  const general = await upsertChannel(workspace.id, 'general', 'Anything and everything', ilya, [
    ilya,
    sara,
    tom,
    maya,
  ]);
  const infra = await upsertChannel(workspace.id, 'infra', 'Builds, deploys, docker pain', sara, [
    ilya,
    sara,
    tom,
  ]);

  // This thread is deliberately about Docker so the "related tasks" panel has
  // real context to match against during a demo: the Campus Events project has
  // an open docker-compose issue that should surface here.
  await seedMessages(infra.id, [
    [sara, 'the docker compose setup is broken again on a clean clone', 2.5],
    [sara, 'web container comes up before postgres is accepting connections', 2.4],
    [ilya, 'same here, i had to add a sleep to get it working locally', 2.2],
    [tom, 'is that a devops thing or should i not worry about it yet', 2.0],
    [sara, 'worth fixing properly, the healthcheck in the compose file is wrong', 1.8],
  ]);

  await seedMessages(general.id, [
    [ilya, 'morning all, standup at 3?', 1.2],
    [maya, 'works for me', 1.1],
    [tom, 'i can make 3', 1.0],
    [ilya, 'i picked up the keyboard navigation issue on the filter sidebar', 0.6],
    [sara, 'nice, that one has been open a while', 0.5],
  ]);

  // A direct message, to show that chat is not limited to project channels.
  const dmKey = [ilya, sara].sort().join(':');
  const dm = await prisma.conversation.upsert({
    where: { dmKey },
    create: { type: 'DM', dmKey, createdById: ilya },
    update: {},
  });
  for (const userId of [ilya, sara]) {
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: dm.id, userId } },
      create: { conversationId: dm.id, userId },
      update: {},
    });
  }
  await seedMessages(dm.id, [
    [sara, 'did you get anywhere with the accessibility audit?', 4],
    [ilya, 'halfway. the filter sidebar is the worst offender', 3.8],
    [sara, 'want me to pair on it tomorrow?', 3.6],
  ]);
  log('Seeded 2 channels and 1 direct message.');

  await seedDocuments(workspace.id, ilya);
}

async function upsertChannel(
  workspaceId: string,
  name: string,
  topic: string,
  createdById: string,
  memberIds: string[],
) {
  const existing = await prisma.conversation.findFirst({
    where: { workspaceId, type: 'CHANNEL', name },
  });

  const channel =
    existing ??
    (await prisma.conversation.create({
      data: { workspaceId, type: 'CHANNEL', name, topic, createdById },
    }));

  for (const userId of memberIds) {
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: channel.id, userId } },
      create: { conversationId: channel.id, userId },
      update: {},
    });
  }

  return channel;
}

/// Messages are given explicit ages in hours so a seeded conversation reads in
/// a sensible order and the recency weighting in tag extraction has something
/// meaningful to work with.
async function seedMessages(
  conversationId: string,
  entries: Array<[authorId: string, body: string, hoursAgo: number]>,
): Promise<void> {
  const existing = await prisma.message.count({ where: { conversationId } });
  if (existing > 0) return;

  let lastAt: Date | null = null;
  for (const [authorId, body, hoursAgo] of entries) {
    const createdAt = new Date(NOW - hoursAgo * 3_600_000);
    await prisma.message.create({
      data: { conversationId, authorId, body, createdAt },
    });
    lastAt = createdAt;
  }

  if (lastAt) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: lastAt },
    });
  }
}

async function seedDocuments(workspaceId: string, authorId: string): Promise<void> {
  const documents = [
    {
      type: 'PLAN' as const,
      title: 'Project Plan',
      paragraphs: [
        'Milestone 1: accessibility audit of the event filter sidebar and the event cards.',
        'Milestone 2: fix the docker compose startup ordering so new contributors can run the app.',
        'Milestone 3: end-to-end tests for the RSVP flow before the mid-term demo.',
      ],
    },
    {
      type: 'REPORT' as const,
      title: 'Final Report',
      paragraphs: [
        'Introduction: this report covers the Campus Events group project.',
        'Method: work was tracked as GitLab issues and split across four contributors.',
      ],
    },
  ];

  for (const doc of documents) {
    const existing = await prisma.document.findFirst({
      where: { workspaceId, type: doc.type },
    });
    if (existing) continue;

    await prisma.document.create({
      data: {
        workspaceId,
        type: doc.type,
        title: doc.title,
        createdById: authorId,
        contentJson: {
          type: 'doc',
          content: doc.paragraphs.map((text) => ({
            type: 'paragraph',
            content: [{ type: 'text', text }],
          })),
        },
      },
    });
  }
  log(`Seeded ${documents.length} documents.`);
}

async function main(): Promise<void> {
  log('Seeding demo data...');
  await seedTaxonomy();
  await seedProjects();
  const userIds = await seedStudents();
  await seedWorkspace(userIds);

  // Recommendations are generated through the real scoring path rather than
  // being hardcoded, so what the demo shows is what the engine actually does.
  log('Scoring recommendations...');
  const results = await refreshAllRecommendations();
  const total = results.reduce((sum, result) => sum + result.scored, 0);
  log(`Generated ${total} recommendations across ${results.length} students.`);

  log('Done. Sign in as any seeded student, or run the app and use GitLab OAuth.');
  await prisma.$disconnect();
}

void main().catch(async (error) => {
  console.error('[seed] failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
