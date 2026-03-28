'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Variable,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TextBlock as TextBlockType } from '@/types/email-builder';
import type { BuilderVariable } from '@/lib/email-builder/variables';

interface TextBlockEditorProps {
  block: TextBlockType;
  onUpdate?: (patch: Partial<TextBlockType>) => void;
  onUpdateDebounced: (patch: Partial<TextBlockType>) => void;
  isSelected: boolean;
  variables?: BuilderVariable[];
}

export function TextBlockEditor({
  block,
  onUpdateDebounced,
  isSelected,
  variables,
}: TextBlockEditorProps) {
  const isUpdatingFromProp = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: block.html || '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[40px] px-2 py-1 text-black',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isUpdatingFromProp.current) return;
      onUpdateDebounced({ html: ed.getHTML() });
    },
  });

  // Sync external HTML changes
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== block.html) {
      isUpdatingFromProp.current = true;
      editor.commands.setContent(block.html || '<p></p>', { emitUpdate: false });
      isUpdatingFromProp.current = false;
    }
  }, [block.html, editor]);

  const insertVariable = useCallback(
    (name: string) => {
      editor?.chain().focus().insertContent(`{{${name}}}`).run();
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
    <div>
      {isSelected && (
        <div className="flex items-center gap-0.5 flex-wrap border-b bg-muted/30 p-1 text-xs">
          <TbBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </TbBtn>

          <Sep />

          <TbBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </TbBtn>

          <Sep />

          <TbBtn
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            title="Align left"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            title="Align center"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </TbBtn>
          <TbBtn
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            title="Align right"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </TbBtn>

          <Sep />

          <TbBtn onClick={addLink} active={editor.isActive('link')} title="Add link">
            <LinkIcon className="h-3.5 w-3.5" />
          </TbBtn>

          {variables && variables.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5" type="button">
                  <Variable className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 max-h-60 overflow-auto" align="start">
                <div className="space-y-2">
                  {variables.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => insertVariable(v.name)}
                      className="w-full text-left text-sm px-2 py-1 rounded hover:bg-muted transition-colors"
                    >
                      <span className="font-mono text-xs text-primary">{`{{${v.name}}}`}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{v.description}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      <div className="[&_.ProseMirror]:min-h-[40px] [&_.ProseMirror]:text-black [&_.ProseMirror_a]:text-blue-600">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function TbBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-6 w-6 p-0', active && 'bg-muted text-foreground')}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border mx-0.5" />;
}
