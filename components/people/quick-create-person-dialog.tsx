'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface QuickCreatedPerson {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface QuickCreatePersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (person: QuickCreatedPerson) => void;
}

export function QuickCreatePersonDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickCreatePersonDialogProps) {
  const params = useParams();
  const slug = params.slug as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      toast.error('First name and last name are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: trimmedFirst,
          last_name: trimmedLast,
          email: email.trim() || null,
          phone: phone.trim() || null,
          force_create: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create person');
      }

      const person = data.person ?? data;
      toast.success(`${trimmedFirst} ${trimmedLast} created`);
      onCreated({
        id: person.id,
        first_name: person.first_name ?? trimmedFirst,
        last_name: person.last_name ?? trimmedLast,
        email: person.email ?? null,
      });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create person');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Quick Add Person</DialogTitle>
          <DialogDescription>
            Create a new person. You can add more details later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qc-first-name">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="qc-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qc-last-name">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="qc-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qc-email">Email</Label>
                <Input
                  id="qc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qc-phone">Phone</Label>
                <Input
                  id="qc-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !firstName.trim() || !lastName.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Person
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
