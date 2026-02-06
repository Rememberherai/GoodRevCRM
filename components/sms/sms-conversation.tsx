'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Send, Loader2, MessageSquare, RefreshCw, Check, CheckCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SmsMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  body: string;
  from_number: string;
  to_number: string;
  created_at: string;
  delivered_at: string | null;
  user?: { id: string; full_name: string | null } | null;
  person?: { id: string; first_name: string; last_name: string } | null;
}

interface SmsConversationProps {
  personId?: string;
  organizationId?: string;
  phoneNumbers: Array<{ number: string; label: string }>;
  entityName?: string;
}

const MAX_SMS_LENGTH = 1600;

function getStatusIcon(status: string) {
  switch (status) {
    case 'delivered':
      return <CheckCheck className="h-3 w-3" />;
    case 'sent':
      return <Check className="h-3 w-3" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    case 'queued':
    case 'sending':
      return <Loader2 className="h-3 w-3 animate-spin" />;
    default:
      return null;
  }
}

export function SmsConversation({
  personId,
  organizationId,
  phoneNumbers,
  entityName,
}: SmsConversationProps) {
  const params = useParams();
  const slug = params.slug as string;
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedNumber, setSelectedNumber] = useState(phoneNumbers[0]?.number || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (personId) params.set('person_id', personId);
      if (organizationId) params.set('organization_id', organizationId);

      const response = await fetch(`/api/projects/${slug}/sms?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching SMS messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug, personId, organizationId]);

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedNumber) return;

    setSending(true);
    try {
      const response = await fetch(`/api/projects/${slug}/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_number: selectedNumber,
          body: newMessage,
          person_id: personId,
          organization_id: organizationId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send SMS');
      }

      toast.success('SMS sent');
      setNewMessage('');
      // Refresh messages
      await fetchMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const characterCount = newMessage.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;

  if (phoneNumbers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No phone number available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a phone or mobile phone number to send SMS
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Messages
            {entityName && <span className="text-muted-foreground font-normal">- {entityName}</span>}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
        {phoneNumbers.length > 1 && (
          <Select value={selectedNumber} onValueChange={setSelectedNumber}>
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="Select phone number" />
            </SelectTrigger>
            <SelectContent>
              {phoneNumbers.map((phone) => (
                <SelectItem key={phone.number} value={phone.number}>
                  {phone.number} ({phone.label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No messages yet. Send the first SMS!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex', message.direction === 'outbound' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-lg px-4 py-2',
                  message.direction === 'outbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                <div
                  className={cn(
                    'flex items-center gap-1 text-xs mt-1',
                    message.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  <span>{new Date(message.created_at).toLocaleString()}</span>
                  {message.direction === 'outbound' && (
                    <span className="ml-1">{getStatusIcon(message.status)}</span>
                  )}
                </div>
                {message.direction === 'outbound' && message.user?.full_name && (
                  <p
                    className={cn(
                      'text-xs mt-0.5',
                      message.direction === 'outbound' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    )}
                  >
                    Sent by {message.user.full_name}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="p-4 border-t flex-shrink-0">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value.slice(0, MAX_SMS_LENGTH))}
              className="min-h-[80px] resize-none pr-20"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {characterCount}/{MAX_SMS_LENGTH}
              <br />
              {segmentCount} segment{segmentCount > 1 ? 's' : ''}
            </div>
          </div>
          <Button
            onClick={handleSend}
            disabled={sending || !newMessage.trim() || !selectedNumber}
            className="self-end"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
