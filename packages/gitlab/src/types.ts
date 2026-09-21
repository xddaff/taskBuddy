/// Subsets of the GitLab REST v4 payloads this app actually reads. Declaring
/// only what is used keeps the indexer honest about its dependencies and makes
/// fixtures in tests manageable.

export interface GitlabUser {
  id: number;
  username: string;
  name: string;
  email?: string;
  avatar_url: string | null;
  web_url: string;
}

export interface GitlabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  avatar_url: string | null;
  star_count: number;
  last_activity_at: string;
  open_issues_count?: number;
  archived?: boolean;
  issues_enabled?: boolean;
}

/// GET /projects/:id/languages returns percentages keyed by language name,
/// e.g. { "TypeScript": 74.2, "CSS": 20.1 }.
export type GitlabLanguages = Record<string, number>;

export interface GitlabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: 'opened' | 'closed';
  web_url: string;
  labels: string[];
  weight: number | null;
  time_stats?: {
    time_estimate: number;
    total_time_spent: number;
  };
  assignees: Array<{ id: number; username: string }>;
  author: { id: number; username: string } | null;
  created_at: string;
  updated_at: string;
  upvotes?: number;
  user_notes_count?: number;
}

/// Payload of a GitLab `issue` webhook event. Only the fields needed to
/// refresh one indexed issue are declared.
export interface GitlabIssueEvent {
  object_kind: 'issue';
  project: { id: number; path_with_namespace: string; web_url: string };
  object_attributes: {
    id: number;
    iid: number;
    title: string;
    description: string | null;
    state: string;
    action?: string;
    labels?: Array<{ title: string }>;
    weight: number | null;
    time_estimate?: number;
    created_at: string;
    updated_at: string;
    url: string;
  };
  assignees?: Array<{ id: number; username: string }>;
  labels?: Array<{ title: string }>;
}
