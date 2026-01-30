'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { NotificationType, NotificationPreference } from '@/types/notification';
import { notificationTypeLabels, notificationCategories } from '@/types/notification';

interface NotificationPreferencesProps {
  preferences: NotificationPreference[];
  onSave: (preferences: Array<{
    notification_type: NotificationType;
    email_enabled: boolean;
    push_enabled: boolean;
    in_app_enabled: boolean;
  }>) => Promise<void>;
}

export function NotificationPreferences({ preferences, onSave }: NotificationPreferencesProps) {
  const [saving, setSaving] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<Map<NotificationType, {
    email_enabled: boolean;
    push_enabled: boolean;
    in_app_enabled: boolean;
  }>>(() => {
    const map = new Map();
    // Initialize with defaults
    Object.values(notificationCategories).flat().forEach((type) => {
      map.set(type, {
        email_enabled: true,
        push_enabled: true,
        in_app_enabled: true,
      });
    });
    // Override with saved preferences
    preferences.forEach((pref) => {
      map.set(pref.notification_type, {
        email_enabled: pref.email_enabled,
        push_enabled: pref.push_enabled,
        in_app_enabled: pref.in_app_enabled,
      });
    });
    return map;
  });

  const updatePreference = (
    type: NotificationType,
    channel: 'email_enabled' | 'push_enabled' | 'in_app_enabled',
    value: boolean
  ) => {
    const current = localPrefs.get(type) || {
      email_enabled: true,
      push_enabled: true,
      in_app_enabled: true,
    };
    setLocalPrefs(new Map(localPrefs).set(type, { ...current, [channel]: value }));
  };

  const toggleAll = (channel: 'email_enabled' | 'push_enabled' | 'in_app_enabled', value: boolean) => {
    const newPrefs = new Map(localPrefs);
    localPrefs.forEach((pref, type) => {
      newPrefs.set(type, { ...pref, [channel]: value });
    });
    setLocalPrefs(newPrefs);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const prefsArray = Array.from(localPrefs.entries()).map(([type, pref]) => ({
        notification_type: type,
        ...pref,
      }));
      await onSave(prefsArray);
    } finally {
      setSaving(false);
    }
  };

  // Check if all are enabled for toggle all
  const allEmail = Array.from(localPrefs.values()).every((p) => p.email_enabled);
  const allPush = Array.from(localPrefs.values()).every((p) => p.push_enabled);
  const allInApp = Array.from(localPrefs.values()).every((p) => p.in_app_enabled);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose how you want to be notified about different events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Global toggles */}
          <div className="flex items-center justify-between py-3 px-4 bg-muted rounded-lg mb-6">
            <span className="font-medium">Toggle All</span>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Switch
                  checked={allEmail}
                  onCheckedChange={(checked) => toggleAll('email_enabled', checked)}
                />
                <Label className="text-sm">Email</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={allPush}
                  onCheckedChange={(checked) => toggleAll('push_enabled', checked)}
                />
                <Label className="text-sm">Push</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={allInApp}
                  onCheckedChange={(checked) => toggleAll('in_app_enabled', checked)}
                />
                <Label className="text-sm">In-App</Label>
              </div>
            </div>
          </div>

          {/* Category preferences */}
          <div className="space-y-6">
            {Object.entries(notificationCategories).map(([category, types]) => (
              <div key={category}>
                <h3 className="font-semibold mb-3">{category}</h3>
                <div className="space-y-3">
                  {types.map((type) => {
                    const pref = localPrefs.get(type) || {
                      email_enabled: true,
                      push_enabled: true,
                      in_app_enabled: true,
                    };

                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-lg"
                      >
                        <span className="text-sm">{notificationTypeLabels[type]}</span>
                        <div className="flex items-center gap-8">
                          <Switch
                            checked={pref.email_enabled}
                            onCheckedChange={(checked) =>
                              updatePreference(type, 'email_enabled', checked)
                            }
                          />
                          <Switch
                            checked={pref.push_enabled}
                            onCheckedChange={(checked) =>
                              updatePreference(type, 'push_enabled', checked)
                            }
                          />
                          <Switch
                            checked={pref.in_app_enabled}
                            onCheckedChange={(checked) =>
                              updatePreference(type, 'in_app_enabled', checked)
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
