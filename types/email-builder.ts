// ── Email Builder Block Types ──────────────────────────────────────────────

export type BlockId = string;

export type BlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer';

export type Alignment = 'left' | 'center' | 'right';

export type DividerStyle = 'solid' | 'dashed' | 'dotted';

/** Web-safe font stacks available in the builder dropdown */
export const WEB_SAFE_FONTS = [
  'Arial, Helvetica, sans-serif',
  'Georgia, "Times New Roman", Times, serif',
  '"Times New Roman", Times, serif',
  'Verdana, Geneva, sans-serif',
  'Tahoma, Geneva, sans-serif',
  '"Courier New", Courier, monospace',
  '"Trebuchet MS", Helvetica, sans-serif',
] as const;

export type WebSafeFont = (typeof WEB_SAFE_FONTS)[number];

// ── Block padding ─────────────────────────────────────────────────────────

export interface BlockPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Base block (shared fields) ────────────────────────────────────────────

export interface BaseBlock {
  id: BlockId;
  type: BlockType;
  padding?: BlockPadding;
  backgroundColor?: string;
}

// ── Concrete block types ──────────────────────────────────────────────────

export interface TextBlock extends BaseBlock {
  type: 'text';
  /** TipTap HTML content. Also used for legacy HTML conversion. */
  html: string;
  align?: Alignment;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  /** Image URL (pasted in v1, uploaded in v2) */
  src: string;
  alt: string;
  /** Width in px, max = globalStyles.contentWidth */
  width: number;
  align: Alignment;
  linkUrl?: string;
}

export interface ButtonBlock extends BaseBlock {
  type: 'button';
  text: string;
  url: string;
  buttonColor: string;
  textColor: string;
  borderRadius: number;
  align: Alignment;
  fullWidth: boolean;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
  color: string;
  thickness: number;
  style: DividerStyle;
}

export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  /** Height in px */
  height: number;
}

/** Discriminated union of all email block types */
export type EmailBlock =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock;

// ── Global styles ─────────────────────────────────────────────────────────

export interface EmailGlobalStyles {
  backgroundColor: string;
  contentWidth: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  linkColor: string;
  textColor: string;
}

export const DEFAULT_GLOBAL_STYLES: EmailGlobalStyles = {
  backgroundColor: '#ffffff',
  contentWidth: 600,
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 16,
  lineHeight: 1.5,
  linkColor: '#1a73e8',
  textColor: '#333333',
};

// ── Email design document ─────────────────────────────────────────────────

export interface EmailDesign {
  version: 1;
  globalStyles: EmailGlobalStyles;
  blocks: EmailBlock[];
}

// ── Validation result ─────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationError {
  blockId?: BlockId;
  field?: string;
  message: string;
  severity: ValidationSeverity;
}
