'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  RemoveFormatting,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VariablePicker } from './variable-picker';
import { cn } from '@/lib/utils';

interface EmailBodyEditorProps {
  value: string;
  onChange: (html: string, text: string) => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function EmailBodyEditor({ value, onChange }: EmailBodyEditorProps) {
  const isUpdatingFromProp = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your email content here...',
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[250px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingFromProp.current) return;
      const html = editor.getHTML();
      onChange(html, stripHtml(html));
    },
  });

  // Sync external value changes (e.g. variable picker insertion)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (value !== currentHtml) {
      isUpdatingFromProp.current = true;
      editor.commands.setContent(value || '', { emitUpdate: false });
      isUpdatingFromProp.current = false;
    }
  }, [value, editor]);

  const insertVariable = useCallback(
    (variable: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    },
    [editor]
  );

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap border rounded-md p-1 bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={addLink}
          active={editor.isActive('link')}
          title="Add link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear formatting"
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <VariablePicker onInsert={insertVariable} />
      </div>

      {/* Editor */}
      <div className="border rounded-md bg-white [&_.ProseMirror]:min-h-[250px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none">
        <EditorContent editor={editor} />
      </div>

      <p className="text-xs text-muted-foreground">
        Use the toolbar to format text. Insert variables like {'{{company_name}}'} using the variable picker.
      </p>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'h-7 w-7 p-0',
        active && 'bg-muted text-foreground'
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}
