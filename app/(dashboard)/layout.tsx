import { AuthProvider } from '@/providers/auth-provider';
import { EnrichmentProvider } from '@/providers/enrichment-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <EnrichmentProvider>{children}</EnrichmentProvider>
    </AuthProvider>
  );
}
