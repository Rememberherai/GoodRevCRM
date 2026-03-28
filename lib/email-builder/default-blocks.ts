import type {
  BlockType,
  EmailBlock,
  TextBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
  EmailDesign,
  EmailGlobalStyles,
} from '@/types/email-builder';
import { DEFAULT_GLOBAL_STYLES } from '@/types/email-builder';

function id(): string {
  return crypto.randomUUID();
}

export function createDefaultTextBlock(): TextBlock {
  return {
    id: id(),
    type: 'text',
    html: '<p></p>',
  };
}

export function createDefaultImageBlock(): ImageBlock {
  return {
    id: id(),
    type: 'image',
    src: '',
    alt: '',
    width: 600,
    align: 'center',
  };
}

export function createDefaultButtonBlock(): ButtonBlock {
  return {
    id: id(),
    type: 'button',
    text: 'Click Here',
    url: '',
    buttonColor: '#1a73e8',
    textColor: '#ffffff',
    borderRadius: 4,
    align: 'center',
    fullWidth: false,
  };
}

export function createDefaultDividerBlock(): DividerBlock {
  return {
    id: id(),
    type: 'divider',
    color: '#e0e0e0',
    thickness: 1,
    style: 'solid',
  };
}

export function createDefaultSpacerBlock(): SpacerBlock {
  return {
    id: id(),
    type: 'spacer',
    height: 24,
  };
}

const blockFactories: Record<BlockType, () => EmailBlock> = {
  text: createDefaultTextBlock,
  image: createDefaultImageBlock,
  button: createDefaultButtonBlock,
  divider: createDefaultDividerBlock,
  spacer: createDefaultSpacerBlock,
};

export function createDefaultBlock(type: BlockType): EmailBlock {
  return blockFactories[type]();
}

export function createDefaultDesign(overrides?: Partial<EmailGlobalStyles>): EmailDesign {
  return {
    version: 1,
    globalStyles: { ...DEFAULT_GLOBAL_STYLES, ...overrides },
    blocks: [],
  };
}
