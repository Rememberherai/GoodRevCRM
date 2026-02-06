'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GmailConnection, GmailApiTester } from '@/components/gmail';
import { TelnyxSettingsPanel } from '@/components/calls/telnyx-settings-panel';
import { User, Mail, Phone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserMenu } from '@/components/layout/user-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/projects" className="text-xl font-bold hover:opacity-80 transition-opacity">GoodRev CRM</Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6 max-w-4xl">
          <div>
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="text-muted-foreground">
              Manage your account settings
            </p>
          </div>

          <Tabs defaultValue="account" className="w-full">
            <TabsList>
              <TabsTrigger value="account" className="gap-2">
                <User className="h-4 w-4" />
                Account
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="phone" className="gap-2">
                <Phone className="h-4 w-4" />
                Phone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile
                  </CardTitle>
                  <CardDescription>
                    Your account information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Name</p>
                        <p className="text-sm">{user?.user_metadata?.full_name ?? 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <p className="text-sm">{user?.email ?? 'Not set'}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="mt-6 space-y-6">
              <GmailConnection />
              <GmailApiTester />
            </TabsContent>

            <TabsContent value="phone" className="mt-6">
              <TelnyxSettingsPanel />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
