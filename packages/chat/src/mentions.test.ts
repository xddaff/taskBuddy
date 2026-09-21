import { describe, expect, it } from 'vitest';
import { dmKeyFor, normaliseChannelName } from './conversations';
import { parseMentions, parseSlashCommand } from './mentions';

describe('parseMentions', () => {
  it('finds mentions and lowercases them', () => {
    expect(parseMentions('hey @Sara and @tom_dev can you look')).toMatchObject({
      usernames: ['sara', 'tom_dev'],
      mentionsEveryone: false,
    });
  });

  it('does not swallow sentence punctuation into the username', () => {
    expect(parseMentions('ask @sara.').usernames).toEqual(['sara']);
    expect(parseMentions('ping @sara, please').usernames).toEqual(['sara']);
  });

  it('recognises the everyone forms without treating them as users', () => {
    for (const body of ['@all please read', '@channel heads up', '@everyone standup']) {
      const parsed = parseMentions(body);
      expect(parsed.mentionsEveryone).toBe(true);
      expect(parsed.usernames).toEqual([]);
    }
  });

  it('ignores email addresses', () => {
    expect(parseMentions('mail me at ilya@example.edu').usernames).toEqual([]);
  });

  it('deduplicates repeated mentions', () => {
    expect(parseMentions('@sara @sara @Sara').usernames).toEqual(['sara']);
  });

  it('returns nothing for a message with no mentions', () => {
    expect(parseMentions('just a normal message')).toMatchObject({
      usernames: [],
      mentionsEveryone: false,
    });
  });
});

describe('parseSlashCommand', () => {
  it('parses a command and its argument', () => {
    expect(parseSlashCommand('/task docker compose')).toEqual({
      name: 'task',
      argument: 'docker compose',
    });
  });

  it('parses a bare command', () => {
    expect(parseSlashCommand('/task')).toEqual({ name: 'task', argument: '' });
  });

  it('only matches at the start of a message', () => {
    expect(parseSlashCommand('see https://example.com/task for details')).toBeNull();
    expect(parseSlashCommand('use a/b to divide')).toBeNull();
  });

  it('is not confused by a lone slash', () => {
    expect(parseSlashCommand('/')).toBeNull();
  });
});

describe('dmKeyFor', () => {
  it('is order independent, so a DM cannot be created twice', () => {
    expect(dmKeyFor('user-b', 'user-a')).toBe(dmKeyFor('user-a', 'user-b'));
  });
});

describe('normaliseChannelName', () => {
  it('lowercases and hyphenates', () => {
    expect(normaliseChannelName('  Build Issues ')).toBe('build-issues');
    expect(normaliseChannelName('infra/deploys')).toBe('infra-deploys');
  });

  it('strips leading and trailing separators', () => {
    expect(normaliseChannelName('--general--')).toBe('general');
  });

  it('returns empty for input with nothing usable', () => {
    expect(normaliseChannelName('###')).toBe('');
  });
});
