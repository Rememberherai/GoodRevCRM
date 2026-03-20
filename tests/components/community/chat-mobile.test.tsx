import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatSettings } from '@/components/chat/chat-settings';

describe('community chat UI', () => {
  it('shows a receipt upload button for community chat input', () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        onStop={vi.fn()}
        isStreaming={false}
        projectSlug="community-hub"
        projectType="community"
      />
    );

    expect(screen.getByTitle('Upload receipt or invoice')).toBeInTheDocument();
  });

  it('does not show receipt upload for standard projects', () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        onStop={vi.fn()}
        isStreaming={false}
        projectSlug="sales-crm"
        projectType="standard"
      />
    );

    expect(screen.queryByTitle('Upload receipt or invoice')).not.toBeInTheDocument();
  });

  it('shows community-specific tool groups in chat settings', () => {
    render(<ChatSettings onBack={vi.fn()} projectType="community" />);

    expect(screen.getByText('Receipt Processing')).toBeInTheDocument();
    expect(screen.getByText('Calendar Sync')).toBeInTheDocument();
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument();
  });
});

