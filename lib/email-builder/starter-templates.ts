/**
 * Starter email templates for the builder.
 * Each template provides a pre-built EmailDesign that users can start from.
 */

import type { EmailDesign } from '@/types/email-builder';
import { DEFAULT_GLOBAL_STYLES } from '@/types/email-builder';

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'newsletter' | 'announcement' | 'event' | 'welcome';
  design: EmailDesign;
}

function id(): string {
  return crypto.randomUUID();
}

const BLANK_TEMPLATE: StarterTemplate = {
  id: 'blank',
  name: 'Blank',
  description: 'Start from scratch with an empty canvas',
  category: 'general',
  design: {
    version: 1,
    globalStyles: { ...DEFAULT_GLOBAL_STYLES },
    blocks: [],
  },
};

const DEFAULT_BUTTON_URL = 'https://example.com';
const DEFAULT_HEADER_IMAGE = 'https://placehold.co/600x240/e5e7eb/6b7280?text=Header+Image';
const DEFAULT_FEATURE_IMAGE = 'https://placehold.co/500x280/e5e7eb/6b7280?text=Feature+Image';

const SIMPLE_MESSAGE: StarterTemplate = {
  id: 'simple-message',
  name: 'Simple Message',
  description: 'A clean text message with a call-to-action button',
  category: 'general',
  design: {
    version: 1,
    globalStyles: { ...DEFAULT_GLOBAL_STYLES },
    blocks: [
      {
        id: id(),
        type: 'text',
        html: '<h1>Your Heading Here</h1>',
        align: 'left',
        padding: { top: 24, right: 16, bottom: 8, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<p>Write your message here. Keep it concise and focused on one key idea or call to action.</p>',
        align: 'left',
        padding: { top: 0, right: 16, bottom: 16, left: 16 },
      },
      {
        id: id(),
        type: 'button',
        text: 'Learn More',
        url: DEFAULT_BUTTON_URL,
        buttonColor: '#1a73e8',
        textColor: '#ffffff',
        borderRadius: 4,
        align: 'left',
        fullWidth: false,
        padding: { top: 8, right: 16, bottom: 24, left: 16 },
      },
    ],
  },
};

const NEWSLETTER: StarterTemplate = {
  id: 'newsletter',
  name: 'Newsletter',
  description: 'Header image, multiple content sections with dividers',
  category: 'newsletter',
  design: {
    version: 1,
    globalStyles: { ...DEFAULT_GLOBAL_STYLES },
    blocks: [
      {
        id: id(),
        type: 'image',
        src: DEFAULT_HEADER_IMAGE,
        alt: 'Newsletter header',
        width: 600,
        align: 'center',
      },
      {
        id: id(),
        type: 'text',
        html: '<h1 style="text-align: center;">Monthly Newsletter</h1>',
        align: 'center',
        padding: { top: 24, right: 16, bottom: 8, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<p style="text-align: center; color: #666;">A quick update on what\'s been happening</p>',
        align: 'center',
        padding: { top: 0, right: 16, bottom: 16, left: 16 },
      },
      {
        id: id(),
        type: 'divider',
        color: '#e0e0e0',
        thickness: 1,
        style: 'solid',
        padding: { top: 8, right: 16, bottom: 8, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<h2>Section One</h2><p>Share your first piece of news or update here. Keep paragraphs short for better readability.</p>',
        align: 'left',
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
      },
      {
        id: id(),
        type: 'divider',
        color: '#e0e0e0',
        thickness: 1,
        style: 'solid',
        padding: { top: 8, right: 16, bottom: 8, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<h2>Section Two</h2><p>Add another topic or update. You can include links, bold text, or other formatting.</p>',
        align: 'left',
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
      },
      {
        id: id(),
        type: 'divider',
        color: '#e0e0e0',
        thickness: 1,
        style: 'solid',
        padding: { top: 8, right: 16, bottom: 8, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<p style="text-align: center; color: #999; font-size: 12px;">You received this email because you are subscribed to our newsletter.</p>',
        align: 'center',
        padding: { top: 16, right: 16, bottom: 24, left: 16 },
      },
    ],
  },
};

const ANNOUNCEMENT: StarterTemplate = {
  id: 'announcement',
  name: 'Announcement',
  description: 'Bold heading with a prominent call-to-action',
  category: 'announcement',
  design: {
    version: 1,
    globalStyles: {
      ...DEFAULT_GLOBAL_STYLES,
      backgroundColor: '#f8f9fa',
    },
    blocks: [
      {
        id: id(),
        type: 'spacer',
        height: 32,
      },
      {
        id: id(),
        type: 'text',
        html: '<h1 style="text-align: center; font-size: 28px;">Big Announcement</h1>',
        align: 'center',
        padding: { top: 24, right: 24, bottom: 8, left: 24 },
        backgroundColor: '#ffffff',
      },
      {
        id: id(),
        type: 'text',
        html: '<p style="text-align: center; font-size: 18px; color: #555;">We have exciting news to share with you.</p>',
        align: 'center',
        padding: { top: 0, right: 24, bottom: 16, left: 24 },
        backgroundColor: '#ffffff',
      },
      {
        id: id(),
        type: 'image',
        src: DEFAULT_FEATURE_IMAGE,
        alt: 'Announcement image',
        width: 500,
        align: 'center',
        backgroundColor: '#ffffff',
        padding: { top: 8, right: 24, bottom: 16, left: 24 },
      },
      {
        id: id(),
        type: 'text',
        html: '<p style="text-align: center;">Here are the details about this announcement. Explain what changed, what\'s new, or what people should know.</p>',
        align: 'center',
        padding: { top: 8, right: 24, bottom: 16, left: 24 },
        backgroundColor: '#ffffff',
      },
      {
        id: id(),
        type: 'button',
        text: 'Get Started',
        url: DEFAULT_BUTTON_URL,
        buttonColor: '#1a73e8',
        textColor: '#ffffff',
        borderRadius: 6,
        align: 'center',
        fullWidth: false,
        padding: { top: 8, right: 24, bottom: 32, left: 24 },
        backgroundColor: '#ffffff',
      },
      {
        id: id(),
        type: 'spacer',
        height: 32,
      },
    ],
  },
};

const EVENT_INVITE: StarterTemplate = {
  id: 'event-invite',
  name: 'Event Invitation',
  description: 'Event details with date, location, and RSVP button',
  category: 'event',
  design: {
    version: 1,
    globalStyles: { ...DEFAULT_GLOBAL_STYLES },
    blocks: [
      {
        id: id(),
        type: 'text',
        html: '<h1 style="text-align: center;">You\'re Invited!</h1>',
        align: 'center',
        padding: { top: 32, right: 16, bottom: 8, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<h2 style="text-align: center; color: #1a73e8;">Event Name</h2>',
        align: 'center',
        padding: { top: 0, right: 16, bottom: 16, left: 16 },
      },
      {
        id: id(),
        type: 'divider',
        color: '#e0e0e0',
        thickness: 1,
        style: 'solid',
        padding: { top: 0, right: 16, bottom: 0, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<p><strong>Date:</strong> Saturday, January 1, 2025</p><p><strong>Time:</strong> 6:00 PM - 9:00 PM</p><p><strong>Location:</strong> 123 Main Street, City, State</p>',
        align: 'left',
        padding: { top: 16, right: 24, bottom: 16, left: 24 },
      },
      {
        id: id(),
        type: 'divider',
        color: '#e0e0e0',
        thickness: 1,
        style: 'solid',
        padding: { top: 0, right: 16, bottom: 0, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<p>Join us for this special event. We\'d love to see you there! Please RSVP by clicking the button below.</p>',
        align: 'left',
        padding: { top: 16, right: 24, bottom: 8, left: 24 },
      },
      {
        id: id(),
        type: 'button',
        text: 'RSVP Now',
        url: DEFAULT_BUTTON_URL,
        buttonColor: '#1a73e8',
        textColor: '#ffffff',
        borderRadius: 4,
        align: 'center',
        fullWidth: false,
        padding: { top: 8, right: 24, bottom: 32, left: 24 },
      },
    ],
  },
};

const WELCOME_EMAIL: StarterTemplate = {
  id: 'welcome',
  name: 'Welcome',
  description: 'Warm welcome message for new members or subscribers',
  category: 'welcome',
  design: {
    version: 1,
    globalStyles: { ...DEFAULT_GLOBAL_STYLES },
    blocks: [
      {
        id: id(),
        type: 'text',
        html: '<h1>Welcome, {{first_name}}!</h1>',
        align: 'left',
        padding: { top: 32, right: 16, bottom: 8, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<p>We\'re thrilled to have you join us. Here\'s what you can expect:</p><ul><li>Regular updates and newsletters</li><li>Access to community events</li><li>Resources and support</li></ul>',
        align: 'left',
        padding: { top: 0, right: 16, bottom: 16, left: 16 },
      },
      {
        id: id(),
        type: 'text',
        html: '<p>If you have any questions, feel free to reach out. We\'re here to help!</p>',
        align: 'left',
        padding: { top: 0, right: 16, bottom: 16, left: 16 },
      },
      {
        id: id(),
        type: 'button',
        text: 'Get Started',
        url: DEFAULT_BUTTON_URL,
        buttonColor: '#1a73e8',
        textColor: '#ffffff',
        borderRadius: 4,
        align: 'left',
        fullWidth: false,
        padding: { top: 8, right: 16, bottom: 32, left: 16 },
      },
    ],
  },
};

/** All available starter templates, ordered for display */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  BLANK_TEMPLATE,
  SIMPLE_MESSAGE,
  NEWSLETTER,
  ANNOUNCEMENT,
  EVENT_INVITE,
  WELCOME_EMAIL,
];

/**
 * Returns a deep clone of a starter template's design with fresh block IDs.
 * This ensures each usage gets unique IDs to avoid key collisions.
 */
export function cloneTemplateDesign(template: StarterTemplate): EmailDesign {
  const cloned = structuredClone(template.design);
  // Regenerate all block IDs
  for (const block of cloned.blocks) {
    block.id = crypto.randomUUID();
  }
  return cloned;
}
