export type TagKind = 'LANGUAGE' | 'FRAMEWORK' | 'TOOL' | 'TOPIC' | 'DOMAIN';

export interface TagDefinition {
  slug: string;
  label: string;
  kind: TagKind;
  /// Alternate spellings matched during extraction. The canonical slug is
  /// always matched too and does not need repeating here.
  aliases: string[];
}

/// The single vocabulary shared by student profiles, GitLab issues and chat
/// messages. Recommendations only work if all three sides normalize onto the
/// same slugs, which is why this lives in one place and is seeded into the
/// database rather than being inferred per call site.
export const TAXONOMY: TagDefinition[] = [
  // ---- languages ----
  { slug: 'typescript', label: 'TypeScript', kind: 'LANGUAGE', aliases: ['ts'] },
  {
    slug: 'javascript',
    label: 'JavaScript',
    kind: 'LANGUAGE',
    aliases: ['js', 'ecmascript', 'es6'],
  },
  { slug: 'python', label: 'Python', kind: 'LANGUAGE', aliases: ['py', 'python3'] },
  { slug: 'java', label: 'Java', kind: 'LANGUAGE', aliases: [] },
  { slug: 'kotlin', label: 'Kotlin', kind: 'LANGUAGE', aliases: [] },
  { slug: 'swift', label: 'Swift', kind: 'LANGUAGE', aliases: [] },
  { slug: 'cpp', label: 'C++', kind: 'LANGUAGE', aliases: ['c plus plus', 'cplusplus'] },
  { slug: 'csharp', label: 'C#', kind: 'LANGUAGE', aliases: ['c sharp', 'dotnet', 'net'] },
  { slug: 'c', label: 'C', kind: 'LANGUAGE', aliases: [] },
  { slug: 'go', label: 'Go', kind: 'LANGUAGE', aliases: ['golang'] },
  { slug: 'rust', label: 'Rust', kind: 'LANGUAGE', aliases: [] },
  { slug: 'ruby', label: 'Ruby', kind: 'LANGUAGE', aliases: [] },
  { slug: 'php', label: 'PHP', kind: 'LANGUAGE', aliases: [] },
  { slug: 'sql', label: 'SQL', kind: 'LANGUAGE', aliases: [] },
  { slug: 'html', label: 'HTML', kind: 'LANGUAGE', aliases: ['html5'] },
  { slug: 'css', label: 'CSS', kind: 'LANGUAGE', aliases: ['css3', 'scss', 'sass'] },
  { slug: 'shell', label: 'Shell', kind: 'LANGUAGE', aliases: ['bash', 'zsh', 'sh'] },
  { slug: 'r', label: 'R', kind: 'LANGUAGE', aliases: [] },
  { slug: 'dart', label: 'Dart', kind: 'LANGUAGE', aliases: [] },

  // ---- frameworks ----
  { slug: 'react', label: 'React', kind: 'FRAMEWORK', aliases: ['reactjs'] },
  { slug: 'nextjs', label: 'Next.js', kind: 'FRAMEWORK', aliases: ['next'] },
  { slug: 'vue', label: 'Vue', kind: 'FRAMEWORK', aliases: ['vuejs'] },
  { slug: 'svelte', label: 'Svelte', kind: 'FRAMEWORK', aliases: ['sveltekit'] },
  { slug: 'angular', label: 'Angular', kind: 'FRAMEWORK', aliases: [] },
  { slug: 'nodejs', label: 'Node.js', kind: 'FRAMEWORK', aliases: ['node'] },
  { slug: 'express', label: 'Express', kind: 'FRAMEWORK', aliases: ['expressjs'] },
  { slug: 'fastapi', label: 'FastAPI', kind: 'FRAMEWORK', aliases: [] },
  { slug: 'django', label: 'Django', kind: 'FRAMEWORK', aliases: [] },
  { slug: 'flask', label: 'Flask', kind: 'FRAMEWORK', aliases: [] },
  { slug: 'spring', label: 'Spring Boot', kind: 'FRAMEWORK', aliases: ['springboot'] },
  { slug: 'rails', label: 'Rails', kind: 'FRAMEWORK', aliases: ['ruby on rails'] },
  { slug: 'laravel', label: 'Laravel', kind: 'FRAMEWORK', aliases: [] },
  { slug: 'flutter', label: 'Flutter', kind: 'FRAMEWORK', aliases: [] },
  { slug: 'react-native', label: 'React Native', kind: 'FRAMEWORK', aliases: ['reactnative'] },
  { slug: 'tailwind', label: 'Tailwind CSS', kind: 'FRAMEWORK', aliases: ['tailwindcss'] },

  // ---- tools / infra ----
  { slug: 'docker', label: 'Docker', kind: 'TOOL', aliases: ['dockerfile', 'containers'] },
  { slug: 'kubernetes', label: 'Kubernetes', kind: 'TOOL', aliases: ['k8s'] },
  { slug: 'postgres', label: 'PostgreSQL', kind: 'TOOL', aliases: ['postgresql', 'psql'] },
  { slug: 'mysql', label: 'MySQL', kind: 'TOOL', aliases: ['mariadb'] },
  { slug: 'mongodb', label: 'MongoDB', kind: 'TOOL', aliases: ['mongo'] },
  { slug: 'redis', label: 'Redis', kind: 'TOOL', aliases: [] },
  { slug: 'prisma', label: 'Prisma', kind: 'TOOL', aliases: [] },
  { slug: 'graphql', label: 'GraphQL', kind: 'TOOL', aliases: ['gql'] },
  { slug: 'rest-api', label: 'REST API', kind: 'TOOL', aliases: ['rest', 'api'] },
  { slug: 'git', label: 'Git', kind: 'TOOL', aliases: [] },
  { slug: 'ci-cd', label: 'CI/CD', kind: 'TOOL', aliases: ['ci', 'cd', 'pipeline', 'gitlab ci'] },
  { slug: 'terraform', label: 'Terraform', kind: 'TOOL', aliases: [] },
  { slug: 'websockets', label: 'WebSockets', kind: 'TOOL', aliases: ['websocket', 'socketio'] },
  { slug: 'figma', label: 'Figma', kind: 'TOOL', aliases: [] },

  // ---- topics ----
  { slug: 'frontend', label: 'Frontend', kind: 'TOPIC', aliases: ['front end', 'ui', 'client'] },
  { slug: 'backend', label: 'Backend', kind: 'TOPIC', aliases: ['back end', 'server'] },
  { slug: 'testing', label: 'Testing', kind: 'TOPIC', aliases: ['tests', 'unit test', 'e2e', 'qa'] },
  { slug: 'documentation', label: 'Documentation', kind: 'TOPIC', aliases: ['docs', 'readme'] },
  {
    slug: 'accessibility',
    label: 'Accessibility',
    kind: 'TOPIC',
    aliases: ['a11y', 'wcag', 'screen reader'],
  },
  { slug: 'performance', label: 'Performance', kind: 'TOPIC', aliases: ['perf', 'optimization'] },
  { slug: 'security', label: 'Security', kind: 'TOPIC', aliases: ['auth', 'authentication', 'vulnerability'] },
  { slug: 'devops', label: 'DevOps', kind: 'TOPIC', aliases: ['infrastructure', 'deployment'] },
  { slug: 'ux-design', label: 'UX Design', kind: 'TOPIC', aliases: ['ux', 'usability', 'design'] },
  { slug: 'data-viz', label: 'Data Visualization', kind: 'TOPIC', aliases: ['charts', 'dataviz'] },
  { slug: 'refactoring', label: 'Refactoring', kind: 'TOPIC', aliases: ['tech debt', 'cleanup'] },
  { slug: 'bug', label: 'Bug Fixing', kind: 'TOPIC', aliases: ['bugfix', 'defect'] },

  // ---- domains ----
  {
    slug: 'machine-learning',
    label: 'Machine Learning',
    kind: 'DOMAIN',
    aliases: ['ml', 'deep learning', 'neural network'],
  },
  { slug: 'nlp', label: 'NLP', kind: 'DOMAIN', aliases: ['natural language processing'] },
  { slug: 'computer-vision', label: 'Computer Vision', kind: 'DOMAIN', aliases: ['cv', 'image recognition'] },
  { slug: 'data-science', label: 'Data Science', kind: 'DOMAIN', aliases: ['analytics'] },
  { slug: 'mobile', label: 'Mobile', kind: 'DOMAIN', aliases: ['android', 'ios'] },
  { slug: 'game-dev', label: 'Game Development', kind: 'DOMAIN', aliases: ['gamedev', 'unity', 'godot'] },
  { slug: 'embedded', label: 'Embedded', kind: 'DOMAIN', aliases: ['iot', 'arduino', 'raspberry pi'] },
  { slug: 'robotics', label: 'Robotics', kind: 'DOMAIN', aliases: ['ros'] },
  { slug: 'blockchain', label: 'Blockchain', kind: 'DOMAIN', aliases: ['web3', 'solidity'] },
];

const bySlug = new Map<string, TagDefinition>();
for (const tag of TAXONOMY) {
  // The taxonomy is authored by hand; a duplicate slug would silently
  // shadow an earlier definition, so collapse rather than overwrite.
  const existing = bySlug.get(tag.slug);
  if (existing) {
    existing.aliases = [...new Set([...existing.aliases, ...tag.aliases])];
    continue;
  }
  bySlug.set(tag.slug, { ...tag, aliases: [...tag.aliases] });
}

/// Deduplicated taxonomy, safe to seed directly.
export const TAGS: TagDefinition[] = [...bySlug.values()];

export function getTag(slug: string): TagDefinition | undefined {
  return bySlug.get(slug);
}

export function tagLabel(slug: string): string {
  return bySlug.get(slug)?.label ?? slug;
}
