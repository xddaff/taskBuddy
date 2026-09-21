'use client';

import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  acquireSectionLock,
  createVersionSnapshot,
  heartbeatSectionLock,
  releaseSectionLock,
  saveDocument,
} from '@/app/(app)/d/[documentId]/actions';
import { Avatar } from '@/components/Avatar';
import { INTRO_SECTION_ID, sectionId, type ProseMirrorDoc } from '@/lib/document-templates';
import { relativeTime } from '@/lib/format';
import styles from './document-editor.module.css';
import { EditorToolbar } from './EditorToolbar';
import type { LockHolder, PresencePayload } from './types';

const AUTOSAVE_IDLE_MS = 1_500;
const HEARTBEAT_MS = 30_000;
const PRESENCE_POLL_MS = 5_000;
/// Clicking the toolbar blurs the editor. Waiting a moment before giving the
/// section lock up stops that from releasing and retaking it on every click.
const BLUR_GRACE_MS = 3_000;
const MAX_RETRY_DELAY_MS = 30_000;

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'retrying' | 'conflict';

interface ConflictState {
  updatedAt: string;
  changedBy: string | null;
}

interface Props {
  documentId: string;
  initialContent: ProseMirrorDoc;
  initialUpdatedAt: string;
  currentUserId: string;
}

/// Reads the section the caret is in: the nearest top-level heading at or
/// above it, or the opening of the document when there is none yet.
function sectionAtCaret(editor: Editor): string {
  const { doc, selection } = editor.state;
  const index = Math.min(selection.$from.index(0), doc.childCount - 1);

  let current = INTRO_SECTION_ID;
  for (let i = 0; i <= index; i++) {
    const node = doc.maybeChild(i);
    if (node?.type.name === 'heading') current = sectionId(node.textContent.trim());
  }
  return current;
}

export function DocumentEditor({
  documentId,
  initialContent,
  initialUpdatedAt,
  currentUserId,
}: Props) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string>(initialUpdatedAt);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [presence, setPresence] = useState<LockHolder[]>([]);
  const [focused, setFocused] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState<string | null>(null);

  const updatedAt = useRef(initialUpdatedAt);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const saving = useRef(false);
  const resaveQueued = useRef(false);
  const retries = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    // Tiptap must not render during SSR in the App Router: the server has no
    // DOM for ProseMirror to attach to and the markup would not match.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: 'document-editor-surface',
        class: styles.surface ?? '',
        'aria-label': 'Document body',
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onUpdate: () => {
      revision.current += 1;
      setStatus((previous) => (previous === 'conflict' ? 'conflict' : 'dirty'));
      scheduleSave();
    },
    onFocus: () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      setFocused(true);
    },
    onBlur: () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      blurTimer.current = setTimeout(() => setFocused(false), BLUR_GRACE_MS);
    },
  });

  const runSave = useCallback(
    async (options: { force?: boolean } = {}) => {
      if (!editor) return;
      if (saving.current) {
        resaveQueued.current = true;
        return;
      }

      saving.current = true;
      const attemptRevision = revision.current;
      setStatus('saving');

      try {
        const result = await saveDocument({
          documentId,
          contentJson: editor.getJSON(),
          expectedUpdatedAt: updatedAt.current,
          force: options.force ?? false,
        });

        if (result.status === 'saved') {
          updatedAt.current = result.updatedAt;
          savedRevision.current = attemptRevision;
          retries.current = 0;
          setLastSavedAt(result.updatedAt);
          setConflict(null);
          setSaveError(null);
          setStatus(revision.current === attemptRevision ? 'saved' : 'dirty');
        } else if (result.status === 'conflict') {
          // Keep the stale updatedAt: every further autosave will conflict too
          // until the user reloads or explicitly keeps their version, which is
          // the point. Nothing has been overwritten.
          setConflict({ updatedAt: result.updatedAt, changedBy: result.changedBy });
          setStatus('conflict');
        } else {
          setSaveError(result.message);
          setStatus('retrying');
          scheduleRetry();
        }
      } catch {
        setSaveError('The server could not be reached.');
        setStatus('retrying');
        scheduleRetry();
      } finally {
        saving.current = false;
        if (resaveQueued.current) {
          resaveQueued.current = false;
          scheduleSave();
        }
      }
    },
    [documentId, editor],
  );

  const runSaveRef = useRef(runSave);
  runSaveRef.current = runSave;

  function scheduleSave(delay = AUTOSAVE_IDLE_MS) {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      void runSaveRef.current();
    }, delay);
  }

  function scheduleRetry() {
    retries.current += 1;
    const delay = Math.min(AUTOSAVE_IDLE_MS * 2 ** retries.current, MAX_RETRY_DELAY_MS);
    scheduleSave(delay);
  }

  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const unsaved = status !== 'saved';
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const activeSection = useEditorState({
    editor,
    selector: ({ editor: instance }) => (instance ? sectionAtCaret(instance) : null),
  });

  useEffect(() => {
    if (!editor || !activeSection || !focused) return;
    let cancelled = false;
    const section = activeSection;

    const claim = async () => {
      const result = await acquireSectionLock({ documentId, sectionId: section });
      if (cancelled) return;
      if (result.status === 'held') {
        setPresence((current) => [
          ...current.filter((lock) => lock.sectionId !== section),
          result.by,
        ]);
      }
    };

    void claim();
    const beat = setInterval(() => {
      void (async () => {
        const result = await heartbeatSectionLock({ documentId, sectionId: section });
        // Losing the lock means it lapsed while the tab was asleep; ask for it
        // back rather than carrying on believing it is held.
        if (!cancelled && result.status === 'error') void claim();
      })();
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(beat);
      void releaseSectionLock({ documentId, sectionId: section });
    };
  }, [documentId, editor, activeSection, focused]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/presence`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const payload = (await response.json()) as PresencePayload;
        if (active) setPresence(payload.locks);
      } catch {
        // A dropped poll is not worth surfacing: locks expire on their own and
        // the next tick re-reads the truth.
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), PRESENCE_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [documentId]);

  const others = useMemo(() => {
    const now = Date.now();
    return presence.filter(
      (lock) => lock.userId !== currentUserId && new Date(lock.expiresAt).getTime() > now,
    );
  }, [presence, currentUserId]);

  const contested = others.find((lock) => lock.sectionId === activeSection) ?? null;

  const takeSnapshot = useCallback(async () => {
    await runSaveRef.current();
    const result = await createVersionSnapshot({ documentId, label: 'Checkpoint' });
    setSnapshotNote(result.ok ? 'Version saved to history.' : (result.message ?? 'Could not save a version.'));
    setTimeout(() => setSnapshotNote(null), 4_000);
  }, [documentId]);

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-(--color-border-subtle) bg-(--color-surface)/95 px-6 py-2 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3">
          {editor ? (
            <EditorToolbar editor={editor} />
          ) : (
            <div
              aria-hidden="true"
              className="h-9 w-64 rounded-lg border border-(--color-border-subtle)"
            />
          )}

          <SaveIndicator
            status={status}
            lastSavedAt={lastSavedAt}
            message={saveError}
          />

          <div className="ml-auto flex items-center gap-3">
            <Presence others={others} />
            <button
              type="button"
              onClick={() => void takeSnapshot()}
              className="rounded-md border border-(--color-border-subtle) px-2.5 py-1 text-xs text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
            >
              Save a version
            </button>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {snapshotNote}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-3xl">
          {conflict && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-(--color-danger) bg-(--color-surface-raised) p-4"
            >
              <h2 className="text-sm font-medium text-(--color-danger)">
                This document changed while you were writing
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-(--color-ink-muted)">
                {conflict.changedBy ? `${conflict.changedBy} saved` : 'Someone else saved'} a newer
                version {relativeTime(conflict.updatedAt)}. Your last edits have{' '}
                <strong className="text-(--color-ink)">not</strong> been saved, so nothing of theirs
                was overwritten. Reload to pick up their version, or keep yours and overwrite
                theirs.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-md bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                >
                  Reload their version
                </button>
                <button
                  type="button"
                  onClick={() => void runSaveRef.current({ force: true })}
                  className="rounded-md border border-(--color-border-subtle) px-3 py-1.5 text-xs transition hover:bg-(--color-surface-hover)"
                >
                  Keep mine and overwrite
                </button>
              </div>
            </div>
          )}

          {contested && (
            <div
              role="status"
              aria-live="polite"
              className="mb-5 flex items-start gap-3 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) p-3"
            >
              <Avatar name={contested.name} image={contested.image} size="sm" />
              <p className="text-sm leading-relaxed text-(--color-ink-muted)">
                <span className="text-(--color-ink)">{contested.name ?? 'Someone'}</span> has been
                editing this section since {relativeTime(contested.acquiredAt)}. You can still type
                — this is a warning, not a lock — but you will both be saving over the same
                paragraphs.
              </p>
            </div>
          )}

          {/* Advisory rather than enforced on purpose: a hard lock held by a
              student who shut their laptop would block the section until it
              expired, and a deadline at 23:50 is the worst possible moment to
              discover that. */}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({
  status,
  lastSavedAt,
  message,
}: {
  status: SaveStatus;
  lastSavedAt: string;
  message: string | null;
}) {
  const text = (() => {
    switch (status) {
      case 'saving':
        return 'Saving…';
      case 'dirty':
        return 'Unsaved changes';
      case 'retrying':
        return `Save failed — retrying${message ? ` (${message})` : ''}`;
      case 'conflict':
        return 'Not saved — conflict';
      default:
        return `Saved ${relativeTime(lastSavedAt)}`;
    }
  })();

  const tone =
    status === 'saved'
      ? 'text-(--color-ink-faint)'
      : status === 'retrying' || status === 'conflict'
        ? 'text-(--color-danger)'
        : 'text-(--color-warning)';

  return (
    <p aria-live="polite" className={`text-xs ${tone}`}>
      {text}
    </p>
  );
}

function Presence({ others }: { others: LockHolder[] }) {
  if (others.length === 0) {
    return <p className="text-xs text-(--color-ink-faint)">Only you here</p>;
  }

  const names = others.map((lock) => lock.name ?? 'Someone').join(', ');

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {others.slice(0, 4).map((lock) => (
          <span key={`${lock.userId}:${lock.sectionId}`} title={`${lock.name ?? 'Someone'} is editing`}>
            <Avatar name={lock.name} image={lock.image} size="sm" />
          </span>
        ))}
      </div>
      <p className="text-xs text-(--color-ink-faint)">
        <span className="sr-only">Currently editing: </span>
        {others.length === 1 ? `${names} is editing` : `${others.length} people editing`}
      </p>
    </div>
  );
}
