'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { createWebhookSchema, webhookEventTypes } from '@/lib/validators/webhook';
import { webhookEventGroups } from '@/types/webhook';
import type { z } from 'zod';
import type { Webhook, WebhookEventType } from '@/types/webhook';

type FormValues = z.infer<typeof createWebhookSchema>;

interface WebhookFormProps {
  webhook?: Webhook;
  onSubmit: (data: FormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function WebhookForm({ webhook, onSubmit, onCancel, loading = false }: WebhookFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: {
      name: webhook?.name ?? '',
      url: webhook?.url ?? '',
      secret: webhook?.secret ?? undefined,
      events: webhook?.events ?? [],
      headers: webhook?.headers ?? {},
      is_active: webhook?.is_active ?? true,
      retry_count: webhook?.retry_count ?? 3,
      timeout_ms: webhook?.timeout_ms ?? 30000,
    },
  });

  const selectedEvents = form.watch('events') ?? [];

  const handleEventToggle = (event: WebhookEventType) => {
    const current = form.getValues('events') ?? [];
    if (current.includes(event)) {
      form.setValue(
        'events',
        current.filter((e) => e !== event),
        { shouldValidate: true }
      );
    } else {
      form.setValue('events', [...current, event], { shouldValidate: true });
    }
  };

  const handleGroupToggle = (events: WebhookEventType[]) => {
    const current = form.getValues('events') ?? [];
    const allSelected = events.every((e) => current.includes(e));

    if (allSelected) {
      form.setValue(
        'events',
        current.filter((e) => !events.includes(e)),
        { shouldValidate: true }
      );
    } else {
      const newEvents = [...new Set([...current, ...events])];
      form.setValue('events', newEvents, { shouldValidate: true });
    }
  };

  const handleSelectAll = () => {
    const allEvents = webhookEventTypes as unknown as WebhookEventType[];
    if (selectedEvents.length === allEvents.length) {
      form.setValue('events', [], { shouldValidate: true });
    } else {
      form.setValue('events', [...allEvents], { shouldValidate: true });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My Webhook" {...field} />
              </FormControl>
              <FormDescription>A friendly name to identify this webhook</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/webhook" {...field} />
              </FormControl>
              <FormDescription>The endpoint that will receive webhook events</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="secret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Secret (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter a secret key (min 16 characters)"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>
                Used to sign webhook payloads. The signature is sent in the X-Webhook-Signature header.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="events"
          render={() => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Events</FormLabel>
                <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedEvents.length === webhookEventTypes.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>
              <FormDescription className="mb-2">
                Select which events should trigger this webhook
              </FormDescription>

              <div className="space-y-4 border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                {Object.entries(webhookEventGroups).map(([group, events]) => {
                  const allSelected = events.every((e) => selectedEvents.includes(e));
                  const someSelected = events.some((e) => selectedEvents.includes(e));

                  return (
                    <div key={group}>
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          checked={allSelected}
                          ref={undefined}
                          onCheckedChange={() => handleGroupToggle(events)}
                          className={someSelected && !allSelected ? 'opacity-50' : ''}
                        />
                        <span className="font-medium capitalize">{group}</span>
                      </div>
                      <div className="ml-6 grid grid-cols-2 gap-2">
                        {events.map((event) => (
                          <div key={event} className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedEvents.includes(event)}
                              onCheckedChange={() => handleEventToggle(event)}
                            />
                            <span className="text-sm">{event}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="retry_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Retry Count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  />
                </FormControl>
                <FormDescription>Number of retry attempts (0-10)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timeout_ms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timeout (ms)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1000}
                    max={60000}
                    step={1000}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  />
                </FormControl>
                <FormDescription>Request timeout (1-60 seconds)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active</FormLabel>
                <FormDescription>Enable or disable this webhook</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : webhook ? 'Update Webhook' : 'Create Webhook'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
