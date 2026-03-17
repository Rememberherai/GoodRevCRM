'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MODELS = [
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Best quality — default' },
  { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku', description: 'Fastest responses' },
  { value: 'openai/gpt-4o', label: 'GPT-4o', description: 'OpenAI flagship' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast and affordable' },
  { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5', description: 'Google large context' },
];

interface ChatSettingsProps {
  onBack: () => void;
}

export function ChatSettings({ onBack }: ChatSettingsProps) {
  // For now, model selection is informational — stored per-conversation in the DB
  // Future: persist model preference and pass to API route

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-sm">Chat Settings</h2>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Model selection */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">AI Model</Label>
          <Select defaultValue="anthropic/claude-3.5-sonnet">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  <div>
                    <div className="text-sm">{model.label}</div>
                    <div className="text-xs text-muted-foreground">{model.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            All models are accessed via OpenRouter. Usage is billed to your OpenRouter API key.
          </p>
        </div>

        {/* Available tools info */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Available Tools</Label>
          <div className="rounded-md border p-3 space-y-2">
            <ToolGroup name="Organizations" tools={['list', 'get', 'create', 'update', 'delete', 'get_people']} />
            <ToolGroup name="People" tools={['list', 'get', 'create', 'update', 'delete', 'link_organization']} />
            <ToolGroup name="Search" tools={['global']} />
          </div>
          <p className="text-xs text-muted-foreground">
            The AI can use these tools to read and modify your CRM data. More tools will be added as features are built.
          </p>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">How it works</Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When you send a message, the AI assistant analyzes your request and decides which CRM tools to use.
            It can chain multiple tool calls together to gather information before responding.
            All actions are performed with your project permissions.
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolGroup({ name, tools }: { name: string; tools: string[] }) {
  return (
    <div>
      <span className="text-xs font-medium">{name}</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {tools.map((tool) => (
          <span key={tool} className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}
