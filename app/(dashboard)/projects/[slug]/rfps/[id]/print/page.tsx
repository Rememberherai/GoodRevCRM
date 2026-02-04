import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/database';
import { PrintActions } from './print-actions';

type RfpRow = Database['public']['Tables']['rfps']['Row'];
type RfpQuestionRow = Database['public']['Tables']['rfp_questions']['Row'];

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function RfpPrintPage({ params }: PageProps) {
  const { slug, id: rfpId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    redirect(`/projects/${slug}/rfps`);
  }

  // Get RFP with organization
  const { data: rfpData } = await supabase
    .from('rfps')
    .select('*, organizations(name)')
    .eq('id', rfpId)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!rfpData) {
    redirect(`/projects/${slug}/rfps`);
  }

  const rfp = rfpData as RfpRow & { organizations: { name: string } | null };

  // Get all questions ordered by section and sort_order
  const { data: questionsData } = await supabase
    .from('rfp_questions')
    .select('*')
    .eq('rfp_id', rfpId)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .order('section_name', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true });

  const questions = (questionsData ?? []) as RfpQuestionRow[];

  // Group by section
  const sections = new Map<string, RfpQuestionRow[]>();
  for (const q of questions) {
    const sectionName = q.section_name ?? 'General';
    if (!sections.has(sectionName)) {
      sections.set(sectionName, []);
    }
    sections.get(sectionName)!.push(q);
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <style>{`
        @media print {
          nav, aside, header, [data-sidebar], [role="navigation"] {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print-page {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .print-section {
            break-inside: avoid;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
        @media screen {
          .print-page {
            max-width: 800px;
            margin: 0 auto;
          }
        }
      `}</style>

      <div className="print-page">
        {/* Print button - hidden when printing */}
        <PrintActions />

        {/* Title block */}
        <div className="text-center mb-8 pb-6 border-b">
          <h1 className="text-3xl font-bold mb-2">{rfp.title}</h1>
          <div className="text-gray-500 space-y-1">
            {rfp.rfp_number && <p>RFP #{rfp.rfp_number}</p>}
            {rfp.organizations?.name && <p>For: {rfp.organizations.name}</p>}
            <p>{dateStr}</p>
          </div>
        </div>

        {/* Questions by section */}
        {Array.from(sections.entries()).map(([sectionName, sectionQuestions]) => {
          const answered = sectionQuestions.filter((q) => q.answer_text);
          if (answered.length === 0) return null;

          return (
            <div key={sectionName} className="mb-8 print-section">
              <h2 className="text-xl font-bold mb-4 pb-2 border-b">{sectionName}</h2>
              <div className="space-y-6">
                {answered.map((q) => (
                  <div key={q.id} className="print-section">
                    <h3 className="font-semibold text-sm mb-1">
                      {q.question_number && (
                        <span className="text-gray-500 mr-1">{q.question_number}.</span>
                      )}
                      {q.question_text}
                    </h3>
                    <div className="text-sm whitespace-pre-wrap pl-4 border-l-2 border-gray-200">
                      {q.answer_text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-12 pt-4 border-t">
          Generated {dateStr}
        </div>
      </div>
    </>
  );
}
