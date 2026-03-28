import { z } from 'zod';

// ── Block padding ─────────────────────────────────────────────────────────

const blockPaddingSchema = z.object({
  top: z.number().min(0).max(100),
  right: z.number().min(0).max(100),
  bottom: z.number().min(0).max(100),
  left: z.number().min(0).max(100),
});

// ── Shared enums ──────────────────────────────────────────────────────────

const alignmentSchema = z.enum(['left', 'center', 'right']);
const dividerStyleSchema = z.enum(['solid', 'dashed', 'dotted']);
const blockTypeSchema = z.enum(['text', 'image', 'button', 'divider', 'spacer']);
const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'Must be a valid hex color');

// ── Base block fields ─────────────────────────────────────────────────────

const baseBlockFields = {
  id: z.string().min(1),
  padding: blockPaddingSchema.optional(),
  backgroundColor: hexColorSchema.optional(),
};

// ── Concrete block schemas ────────────────────────────────────────────────

const textBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal('text'),
  html: z.string(),
  align: alignmentSchema.optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().min(8).max(72).optional(),
  textColor: hexColorSchema.optional(),
});

const imageBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal('image'),
  src: z.string(),
  alt: z.string(),
  width: z.number().min(10).max(1200),
  align: alignmentSchema,
  linkUrl: z.string().optional(),
});

const buttonBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal('button'),
  text: z.string(),
  url: z.string(),
  buttonColor: hexColorSchema,
  textColor: hexColorSchema,
  borderRadius: z.number().min(0).max(50),
  align: alignmentSchema,
  fullWidth: z.boolean(),
});

const dividerBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal('divider'),
  color: hexColorSchema,
  thickness: z.number().min(1).max(10),
  style: dividerStyleSchema,
});

const spacerBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal('spacer'),
  height: z.number().min(4).max(200),
});

// ── Discriminated union ───────────────────────────────────────────────────

export const emailBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
]);

// ── Global styles ─────────────────────────────────────────────────────────

export const emailGlobalStylesSchema = z.object({
  backgroundColor: hexColorSchema,
  contentWidth: z.number().min(320).max(800),
  fontFamily: z.string(),
  fontSize: z.number().min(10).max(32),
  lineHeight: z.number().min(1).max(3),
  linkColor: hexColorSchema,
  textColor: hexColorSchema,
});

// ── Email design document ─────────────────────────────────────────────────

export const emailDesignSchema = z.object({
  version: z.literal(1),
  globalStyles: emailGlobalStylesSchema,
  blocks: z.array(emailBlockSchema),
});

// ── Re-exports for convenience ────────────────────────────────────────────

export {
  blockTypeSchema,
  alignmentSchema,
  dividerStyleSchema,
  blockPaddingSchema,
  hexColorSchema,
  textBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
};
