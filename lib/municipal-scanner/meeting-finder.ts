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
    // - AllNet Meetings: iframe src with allnetmeetings.com
    // - eSCRIBE: Meeting.aspx?Id=...
    // - Direct PDF links: .pdf
    // - Agenda/Minutes pages

    // Pattern 0: AllNet Meetings iframe - fetch the iframe content
    const iframePattern = /src=["']([^"']*allnetmeetings\.com[^"']*)/gi;
    let iframeMatch;
    while ((iframeMatch = iframePattern.exec(html)) !== null) {
      const iframeUrl = iframeMatch[1];
      if (!iframeUrl) continue;

      try {
        console.log(`    📦 Found AllNet iframe, fetching: ${iframeUrl}`);
        const iframeResponse = await fetch(iframeUrl);
        if (iframeResponse.ok) {
          const iframeHtml = await iframeResponse.text();

          // Look for publicAgenda.aspx links in the iframe content (with or without quotes)
          const agendaPattern = /href=["']?([^"'\s>]*publicAgenda\.aspx[^"'\s>]*)/gi;
          let agendaMatch;
          while ((agendaMatch = agendaPattern.exec(iframeHtml)) !== null) {
            let agendaUrl = agendaMatch[1];
            if (!agendaUrl) continue;

            // Make absolute URL
            if (!agendaUrl.startsWith('http')) {
              const iframeBase = new URL(iframeUrl);
              if (agendaUrl.startsWith('/')) {
                agendaUrl = `${iframeBase.protocol}//${iframeBase.host}${agendaUrl}`;
              } else {
                agendaUrl = `${iframeBase.protocol}//${iframeBase.host}/${agendaUrl}`;
              }
            }

            if (!meetings.some(m => m.url === agendaUrl)) {
              meetings.push({
                url: agendaUrl,
                type: 'html',
              });
            }
          }
        }
      } catch (err) {
        console.error(`    ⚠️  Failed to fetch iframe: ${err}`);
      }
    }

    // Pattern 1: Winnipeg DMIS - ShowDoc.asp?DocId=...
    const dmisPattern = /ShowDoc\.asp\?DocId=\d+/gi;
    const dmisMatches = html.match(dmisPattern) || [];

    for (const match of dmisMatches) {
      let fullUrl = match;
      if (!fullUrl.startsWith('http')) {
        fullUrl = `${baseUrl.protocol}//${baseUrl.host}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
      }

      if (!meetings.some(m => m.url === fullUrl)) {
        meetings.push({
          url: fullUrl,
          type: 'html',
        });
      }
    }

    // Pattern 2: eSCRIBE Meeting links
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

    // Pattern 3: PDF links
    const pdfPattern = /href=["']([^"']*\.pdf[^"']*)/gi;
    let pdfMatch;
    while ((pdfMatch = pdfPattern.exec(html)) !== null) {
      let pdfUrl = pdfMatch[1];
      if (!pdfUrl) continue;

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

    // Pattern 4: Meeting-specific HTML pages with dates
    const meetingPagePattern = /href=["']([^"']*(?:meeting|agenda|minutes)[^"']*\d{4}[^"']*)/gi;
    let meetingPageMatch;
    while ((meetingPageMatch = meetingPagePattern.exec(html)) !== null) {
      let meetingUrl = meetingPageMatch[1];
      if (!meetingUrl) continue;

      // Skip already found PDFs
      if (meetingUrl.includes('.pdf')) continue;

      // Skip non-meeting pages (forms, policy pages, etc.)
      const lowerUrl = meetingUrl.toLowerCase();
      if (
        lowerUrl.includes('formcenter') ||
        lowerUrl.includes('master-plan') ||
        lowerUrl.includes('action-plan') ||
        lowerUrl.includes('requirements') ||
        lowerUrl.includes('utility-fees') ||
        lowerUrl.includes('/environment') ||
        lowerUrl.match(/\/(water|waste|utilities)$/)
      ) {
        continue;
      }

      // Make absolute URL
      if (!meetingUrl.startsWith('http')) {
        if (meetingUrl.startsWith('/')) {
          meetingUrl = `${baseUrl.protocol}//${baseUrl.host}${meetingUrl}`;
        } else {
          meetingUrl = `${baseUrl.protocol}//${baseUrl.host}/${meetingUrl}`;
        }
      }

      if (!meetings.some(m => m.url === meetingUrl)) {
        meetings.push({
          url: meetingUrl,
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
      // For PDFs, use pdf-parse library
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        await parser.destroy();
        return result.text;
      } catch (pdfError: any) {
        console.error(`    ⚠️  PDF parsing failed: ${pdfError.message}`);
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
