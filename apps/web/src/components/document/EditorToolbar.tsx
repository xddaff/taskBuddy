'use client';

import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface Props {
  editor: Editor;
  disabled?: boolean;
}

export function EditorToolbar({ editor, disabled = false }: Props) {
  const container = useRef<HTMLDivElement>(null);

  const marks = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive('bold'),
      italic: instance.isActive('italic'),
      heading2: instance.isActive('heading', { level: 2 }),
      heading3: instance.isActive('heading', { level: 3 }),
      bulletList: instance.isActive('bulletList'),
      orderedList: instance.isActive('orderedList'),
      blockquote: instance.isActive('blockquote'),
      codeBlock: instance.isActive('codeBlock'),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });

  /// `role="toolbar"` promises arrow-key navigation, so the group behaves as
  /// one tab stop with left/right moving between controls.
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    const buttons = Array.from(
      container.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
    );
    if (buttons.length === 0) return;

    const index = buttons.findIndex((button) => button === document.activeElement);
    let next = index;
    if (event.key === 'ArrowLeft') next = index <= 0 ? buttons.length - 1 : index - 1;
    if (event.key === 'ArrowRight') next = index === buttons.length - 1 ? 0 : index + 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;

    buttons[next]?.focus();
    event.preventDefault();
  }, []);

  return (
    <div
      ref={container}
      role="toolbar"
      aria-label="Text formatting"
      aria-controls="document-editor-surface"
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-1.5 py-1"
    >
      <ToolbarButton
        label="Bold"
        pressed={marks.bold}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolbarButton>

      <ToolbarButton
        label="Italic"
        pressed={marks.italic}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-serif italic">I</span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Section heading"
        pressed={marks.heading2}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>

      <ToolbarButton
        label="Sub heading"
        pressed={marks.heading3}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bulleted list"
        pressed={marks.bulletList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <span aria-hidden="true">•—</span>
      </ToolbarButton>

      <ToolbarButton
        label="Numbered list"
        pressed={marks.orderedList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <span aria-hidden="true">1.</span>
      </ToolbarButton>

      <ToolbarButton
        label="Quote"
        pressed={marks.blockquote}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <span aria-hidden="true">&rdquo;</span>
      </ToolbarButton>

      <ToolbarButton
        label="Code block"
        pressed={marks.codeBlock}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <span aria-hidden="true" className="font-mono text-[11px]">
          {'{ }'}
        </span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Undo"
        disabled={disabled || !marks.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <span aria-hidden="true">↺</span>
      </ToolbarButton>

      <ToolbarButton
        label="Redo"
        disabled={disabled || !marks.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <span aria-hidden="true">↻</span>
      </ToolbarButton>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-(--color-border-subtle)" />;
}

function ToolbarButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // Buttons that toggle a mark expose state; undo and redo are plain
      // actions and would be lying if they reported one.
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
        pressed
          ? 'bg-(--color-accent-soft) text-(--color-ink)'
          : 'text-(--color-ink-muted) hover:bg-(--color-surface-hover) hover:text-(--color-ink)'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
