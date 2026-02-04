import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import type { Database } from '@/types/database';

type RfpRow = Database['public']['Tables']['rfps']['Row'];
type RfpQuestionRow = Database['public']['Tables']['rfp_questions']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/rfps/[id]/export?format=docx|csv
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id: rfpId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get RFP with organization
    const { data: rfpData, error: rfpError } = await supabase
      .from('rfps')
      .select('*, organizations(name)')
      .eq('id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (rfpError || !rfpData) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    const rfp = rfpData as RfpRow & { organizations: { name: string } | null };

    // Get all questions ordered by section and sort_order
    const { data: questionsData, error: questionsError } = await supabase
      .from('rfp_questions')
      .select('*')
      .eq('rfp_id', rfpId)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .order('section_name', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true });

    if (questionsError) {
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    const questions = (questionsData ?? []) as RfpQuestionRow[];

    // Parse format
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') ?? 'docx';

    if (format === 'csv') {
      return generateCsv(rfp, questions);
    }

    return generateDocx(rfp, questions);
  } catch (error) {
    console.error('Error in GET /api/.../export:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}

function generateCsv(
  rfp: RfpRow & { organizations: { name: string } | null },
  questions: RfpQuestionRow[]
): Response {
  const escapeField = (value: string | null): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = ['Section', 'Question Number', 'Question', 'Answer', 'Status', 'Priority'];
  const rows = questions.map((q) => [
    escapeField(q.section_name),
    escapeField(q.question_number),
    escapeField(q.question_text),
    escapeField(q.answer_text),
    escapeField(q.status),
    escapeField(q.priority),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\r\n');

  const safeTitle = (rfp.title ?? 'RFP').replace(/[^a-zA-Z0-9_-]/g, '_');

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeTitle}_Questions.csv"`,
    },
  });
}

async function generateDocx(
  rfp: RfpRow & { organizations: { name: string } | null },
  questions: RfpQuestionRow[]
): Promise<Response> {
  // Group questions by section
  const sections = new Map<string, RfpQuestionRow[]>();
  for (const q of questions) {
    const sectionName = q.section_name ?? 'General';
    if (!sections.has(sectionName)) {
      sections.set(sectionName, []);
    }
    sections.get(sectionName)!.push(q);
  }

  // Only include questions that have answers
  const answeredQuestions = questions.filter((q) => q.answer_text);

  if (answeredQuestions.length === 0) {
    return NextResponse.json(
      { error: 'No answered questions to export' },
      { status: 400 }
    );
  }

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: rfp.title,
          bold: true,
          size: 48, // 24pt
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Subtitle - RFP number and org
  const subtitleParts: string[] = [];
  if (rfp.rfp_number) subtitleParts.push(`RFP #${rfp.rfp_number}`);
  if (rfp.organizations?.name) subtitleParts.push(`For: ${rfp.organizations.name}`);

  if (subtitleParts.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: subtitleParts.join('  |  '),
            size: 24, // 12pt
            color: '666666',
            font: 'Calibri',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      })
    );
  }

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }),
          size: 22,
          color: '999999',
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Separator
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      spacing: { after: 400 },
    })
  );

  // Sections and questions
  for (const [sectionName, sectionQuestions] of sections) {
    const answered = sectionQuestions.filter((q) => q.answer_text);
    if (answered.length === 0) continue;

    // Section heading
    children.push(
      new Paragraph({
        text: sectionName,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const q of answered) {
      // Question
      const questionLabel = q.question_number
        ? `${q.question_number}. ${q.question_text}`
        : q.question_text;

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: questionLabel,
              bold: true,
              size: 22,
              font: 'Calibri',
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      // Answer - split by newlines to preserve paragraph breaks
      const answerLines = (q.answer_text ?? '').split('\n');
      for (const line of answerLines) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 22,
                font: 'Calibri',
              }),
            ],
            spacing: { after: 80 },
          })
        );
      }

      // Small gap after answer
      children.push(
        new Paragraph({
          spacing: { after: 100 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeTitle = (rfp.title ?? 'RFP').replace(/[^a-zA-Z0-9_-]/g, '_');

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeTitle}_Response.docx"`,
    },
  });
}
