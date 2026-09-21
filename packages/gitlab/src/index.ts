export * from './types';
export * from './client';
export * from './health';

/// OAuth endpoints for a GitLab instance. Derived from the instance root
/// rather than hardcoded, which is what lets the app point at a university
/// instance in one place.
export function gitlabOAuthEndpoints(baseUrl: string) {
  const root = baseUrl.replace(/\/+$/, '');
  return {
    issuer: root,
    authorization: `${root}/oauth/authorize`,
    token: `${root}/oauth/token`,
    userinfo: `${root}/oauth/userinfo`,
    jwks: `${root}/oauth/discovery/keys`,
  };
}

/// Least-privilege scopes for this app.
///
/// `read_api` rather than `api`: recommendations only ever read. Claiming a
/// task is recorded locally and deep-links to GitLab, so nothing here needs
/// write access to a student's account.
export const GITLAB_OAUTH_SCOPES = ['openid', 'profile', 'email', 'read_api'] as const;
