import { JournalEntryDetail } from '@/components/accounting/journal-entry-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JournalEntryPage({ params }: PageProps) {
  const { id } = await params;
  return <JournalEntryDetail entryId={id} />;
}
