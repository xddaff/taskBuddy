function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env.`);
  }
  return value;
}

export const env = {
  authSecret: () => required('AUTH_SECRET', process.env.AUTH_SECRET),
  tokenEncryptionKey: () => required('TOKEN_ENCRYPTION_KEY', process.env.TOKEN_ENCRYPTION_KEY),

  gitlabBaseUrl: process.env.GITLAB_BASE_URL ?? 'https://gitlab.com',
  gitlabClientId: process.env.GITLAB_CLIENT_ID ?? '',
  gitlabClientSecret: process.env.GITLAB_CLIENT_SECRET ?? '',
  gitlabIndexToken: process.env.GITLAB_INDEX_TOKEN ?? '',
  gitlabWebhookSecret: process.env.GITLAB_WEBHOOK_SECRET,

  realtimeUrl: process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:3001',

  uploadsDir: process.env.UPLOADS_DIR ?? './uploads',
  maxUploadBytes: Number.parseInt(process.env.MAX_UPLOAD_BYTES ?? '10485760', 10),

  /// True once an OAuth application has been registered on the instance.
  get gitlabOAuthConfigured(): boolean {
    return Boolean(this.gitlabClientId && this.gitlabClientSecret);
  },

  /// Lets the demo run before GitLab OAuth credentials exist, by signing in as
  /// a seeded student. Refused outright in production: this bypasses
  /// authentication entirely and must never be reachable on a deployed
  /// instance.
  get devLoginEnabled(): boolean {
    return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_LOGIN === 'true';
  },
};
