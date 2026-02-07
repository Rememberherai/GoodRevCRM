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

    // UNIVERSAL APPROACH: Find ALL links, then filter intelligently
    // This works across any municipal website system without custom patterns

    // First check for iframes - some sites embed meeting systems
    const iframePattern = /<iframe[^>]*src=["']([^"']+)["']/gi;
    let iframeMatch;
    const iframeSources: string[] = [];
    while ((iframeMatch = iframePattern.exec(html)) !== null) {
      const iframeUrl = iframeMatch[1];
      if (iframeUrl) {
        iframeSources.push(iframeUrl);
      }
    }

    // Fetch iframe content if present
    let combinedHtml = html;
    for (const iframeUrl of iframeSources) {
      try {
        console.log(`    📦 Found iframe, fetching: ${iframeUrl}`);
        const iframeResponse = await fetch(iframeUrl);
        if (iframeResponse.ok) {
          const iframeHtml = await iframeResponse.text();
          // Add iframe content to combined HTML for link extraction
          combinedHtml += '\n' + iframeHtml;
        }
      } catch (err) {
        console.error(`    ⚠️  Failed to fetch iframe: ${err}`);
      }
    }

    // Extract ALL links from HTML (with or without quotes)
    const allLinksPattern = /href=["']?([^"'\s>]+)["'\s>]/gi;
    const allLinks: Array<{ url: string; linkText: string }> = [];
    let linkMatch;

    while ((linkMatch = allLinksPattern.exec(combinedHtml)) !== null) {
      const rawUrl = linkMatch[1];
      if (!rawUrl) continue;

      // Find the link text (between <a> and </a>)
      const linkTextMatch = combinedHtml.substring(linkMatch.index, linkMatch.index + 500).match(/>([^<]*)</);
      const linkText = linkTextMatch ? linkTextMatch[1]?.trim() || '' : '';

      allLinks.push({ url: rawUrl, linkText });
    }

    console.log(`    🔗 Found ${allLinks.length} total links, filtering for meetings...`);

    // High-value keywords that strongly suggest meeting documents
    const strongKeywords = [
      'agenda', 'minute', 'minutes'
    ];

    // Meeting-related keywords for filtering
    const meetingKeywords = [
      'meeting', 'council', 'committee',
      'session', 'board', 'commission', 'regular', 'special'
    ];

    // Industry-specific keywords
    const industryKeywords = [
      'public works', 'water', 'waste', 'wastewater', 'environment',
      'utilities', 'infrastructure'
    ];

    // Date patterns to identify recent documents
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear - 2];
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];

    // Date number patterns (like "February 4", "May 21", etc.)
    const dateNumberPattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/i;

    // Words that suggest navigation/non-content pages (to exclude)
    const excludeKeywords = [
      'formcenter', 'master-plan', 'action-plan', 'requirements',
      'utility-fees', 'contact', 'about', 'home', 'login', 'search',
      'accessibility', 'privacy', 'terms', 'sitemap', 'rss', 'feed',
      'facebook', 'twitter', 'youtube', 'instagram', 'social',
      'organizations', 'committees', 'staff', 'departments', 'employment',
      'careers', 'apply', 'forms', 'bylaws', 'policies', 'ordinances',
      'recycling', 'collection', 'schedule' // These are usually info pages, not meetings
    ];

    // Patterns that suggest it's a document link (not navigation)
    const documentPatterns = [
      /\.(pdf|docx?|xlsx?)(\?|$)/i, // File extensions
      /download_file|getfile|viewfile|showdoc/i, // Download/view endpoints
      /publicagenda\.aspx|meeting\.aspx/i, // Meeting system pages
      /\?.*id=/i, // Query parameters with IDs
    ];

    for (const { url: rawUrl, linkText } of allLinks) {
      let meetingUrl = rawUrl;

      // Make absolute URL
      try {
        if (!meetingUrl.startsWith('http')) {
          if (meetingUrl.startsWith('/')) {
            meetingUrl = `${baseUrl.protocol}//${baseUrl.host}${meetingUrl}`;
          } else if (meetingUrl.startsWith('..')) {
            continue; // Skip relative parent paths
          } else if (!meetingUrl.includes('://')) {
            meetingUrl = `${baseUrl.protocol}//${baseUrl.host}/${meetingUrl}`;
          }
        }
      } catch {
        continue;
      }

      // Skip anchors, javascript, mailto, tel
      if (
        meetingUrl.includes('#') ||
        meetingUrl.startsWith('javascript:') ||
        meetingUrl.startsWith('mailto:') ||
        meetingUrl.startsWith('tel:')
      ) {
        continue;
      }

      const lowerUrl = meetingUrl.toLowerCase();
      const lowerText = linkText.toLowerCase();
      const combined = lowerUrl + ' ' + lowerText;

      // Skip if contains exclude keywords
      if (excludeKeywords.some(kw => combined.includes(kw))) {
        continue;
      }

      // Skip if URL is just the base page (navigation link)
      if (meetingUrl === calendarUrl || meetingUrl === calendarUrl + '/') {
        continue;
      }

      // Calculate relevance score
      let score = 0;
      let isDocumentLink = false;

      // Check if it matches document patterns (strong indicator)
      for (const pattern of documentPatterns) {
        if (pattern.test(meetingUrl) || pattern.test(linkText)) {
          isDocumentLink = true;
          score += 3;
          break;
        }
      }

      // Check for strong keywords (agenda, minutes)
      for (const keyword of strongKeywords) {
        if (combined.includes(keyword)) {
          score += 4;
        }
      }

      // Check for meeting keywords
      for (const keyword of meetingKeywords) {
        if (combined.includes(keyword)) {
          score += 2;
        }
      }

      // Check for industry keywords (less important)
      for (const keyword of industryKeywords) {
        if (combined.includes(keyword)) {
          score += 1;
        }
      }

      // Check for recent year in URL or text
      for (const year of recentYears) {
        if (combined.includes(String(year))) {
          score += 3;
        }
      }

      // Check for month names
      for (const month of monthNames) {
        if (combined.includes(month)) {
          score += 2;
        }
      }

      // Check for date patterns like "February 4", "May 21"
      if (dateNumberPattern.test(combined)) {
        score += 3;
      }

      // PDF files get bonus points if they have meeting keywords
      const isPdf = lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?');
      if (isPdf && score > 0) {
        score += 2;
      }

      // Must have minimum score to be considered
      // If it's a document link (download_file, publicAgenda, etc.), lower threshold
      const minScore = isDocumentLink ? 4 : 6;
      if (score < minScore) {
        continue;
      }

      // Check if already added
      if (meetings.some(m => m.url === meetingUrl)) {
        continue;
      }

      meetings.push({
        url: meetingUrl,
        type: isPdf ? 'pdf' : 'html',
        title: linkText || undefined,
      });
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
