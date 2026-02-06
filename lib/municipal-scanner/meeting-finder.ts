import { extractTextFromHtml } from './ai-extractor';

export interface MeetingDocument {
  url: string;
  title?: string;
  date?: string;
  type: 'pdf' | 'html';
}

/**
 * Extract meeting document links from a municipality's meeting calendar/listing page
 */
export async function findMeetingDocuments(
  calendarUrl: string,
  monthsBack: number = 12
): Promise<MeetingDocument[]> {
  try {
    const response = await fetch(calendarUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const baseUrl = new URL(calendarUrl);
    const meetings: MeetingDocument[] = [];

    // Calculate cutoff date (monthsBack ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

    // Extract links from HTML
    // Look for common patterns in municipal meeting systems:
    // - eSCRIBE: Meeting.aspx?Id=...
    // - Direct PDF links: .pdf
    // - Agenda/Minutes pages

    // Pattern 1: eSCRIBE Meeting links
    const escribePattern = /Meeting\.aspx\?Id=[a-f0-9-]+(?:&[^"'\s<>]*)?/gi;
    const escribeMatches = html.match(escribePattern) || [];

    for (const match of escribeMatches) {
      // Make absolute URL
      let fullUrl = match;
      if (!fullUrl.startsWith('http')) {
        fullUrl = `${baseUrl.protocol}//${baseUrl.host}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
      }

      // Avoid duplicates
      if (!meetings.some(m => m.url === fullUrl)) {
        meetings.push({
          url: fullUrl,
          type: 'html',
        });
      }
    }

    // Pattern 2: PDF links
    const pdfPattern = /href=["']([^"']*\.pdf[^"']*)/gi;
    let pdfMatch;
    while ((pdfMatch = pdfPattern.exec(html)) !== null) {
      let pdfUrl = pdfMatch[1];

      // Make absolute URL
      if (!pdfUrl.startsWith('http')) {
        if (pdfUrl.startsWith('/')) {
          pdfUrl = `${baseUrl.protocol}//${baseUrl.host}${pdfUrl}`;
        } else {
          pdfUrl = `${baseUrl.protocol}//${baseUrl.host}/${pdfUrl}`;
        }
      }

      // Filter for likely meeting documents (not just any PDF)
      const lowerUrl = pdfUrl.toLowerCase();
      if (
        lowerUrl.includes('agenda') ||
        lowerUrl.includes('minute') ||
        lowerUrl.includes('council') ||
        lowerUrl.includes('meeting') ||
        lowerUrl.includes('committee') ||
        lowerUrl.includes('public works') ||
        lowerUrl.includes('water') ||
        lowerUrl.includes('waste') ||
        lowerUrl.includes('environment') ||
        lowerUrl.includes('utilities')
      ) {
        if (!meetings.some(m => m.url === pdfUrl)) {
          meetings.push({
            url: pdfUrl,
            type: 'pdf',
          });
        }
      }
    }

    // Pattern 3: Committee-specific meetings (Public Works, Water Commission, etc.)
    const committeePattern = /href=["']([^"']*(?:public[_\s-]?works|water[_\s-]?commission|environment|waste|utilities|infrastructure)[^"']*)/gi;
    let committeeMatch;
    while ((committeeMatch = committeePattern.exec(html)) !== null) {
      let committeeUrl = committeeMatch[1];

      // Skip already found PDFs
      if (committeeUrl.includes('.pdf')) continue;

      // Make absolute URL
      if (!committeeUrl.startsWith('http')) {
        if (committeeUrl.startsWith('/')) {
          committeeUrl = `${baseUrl.protocol}//${baseUrl.host}${committeeUrl}`;
        } else {
          committeeUrl = `${baseUrl.protocol}//${baseUrl.host}/${committeeUrl}`;
        }
      }

      if (!meetings.some(m => m.url === committeeUrl)) {
        meetings.push({
          url: committeeUrl,
          type: 'html',
        });
      }
    }

    // Pattern 4: Generic meeting links
    const meetingLinkPattern = /href=["']([^"']*(?:meeting|agenda|minutes)[^"']*)/gi;
    let linkMatch;
    while ((linkMatch = meetingLinkPattern.exec(html)) !== null) {
      let linkUrl = linkMatch[1];

      // Skip already found
      if (linkUrl.includes('.pdf')) continue;

      // Make absolute URL
      if (!linkUrl.startsWith('http')) {
        if (linkUrl.startsWith('/')) {
          linkUrl = `${baseUrl.protocol}//${baseUrl.host}${linkUrl}`;
        } else {
          linkUrl = `${baseUrl.protocol}//${baseUrl.host}/${linkUrl}`;
        }
      }

      if (!meetings.some(m => m.url === linkUrl)) {
        meetings.push({
          url: linkUrl,
          type: 'html',
        });
      }
    }

    console.log(`  📎 Found ${meetings.length} meeting document links`);

    // Limit to reasonable number to avoid overwhelming
    return meetings.slice(0, 50); // Max 50 meetings

  } catch (error: any) {
    console.error(`  ❌ Error finding meetings: ${error.message}`);
    return [];
  }
}

/**
 * Fetch and extract text from a meeting document
 */
export async function fetchMeetingContent(
  meeting: MeetingDocument
): Promise<string | null> {
  try {
    const response = await fetch(meeting.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (meeting.type === 'pdf') {
      // For PDFs, we'll need the unpdf library
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        const { extractText } = await import('unpdf');
        const { text } = await extractText(buffer, { mergePages: true });
        return text;
      } catch (pdfError) {
        console.error(`    ⚠️  PDF parsing failed, skipping`);
        return null;
      }
    } else {
      // HTML
      const html = await response.text();
      return extractTextFromHtml(html);
    }
  } catch (error: any) {
    console.error(`    ⚠️  Failed to fetch ${meeting.url.substring(0, 60)}...`);
    return null;
  }
}
