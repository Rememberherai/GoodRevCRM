/**
 * Grants.gov search2 API client
 * Docs: https://grants.gov/api/common/search2
 * No authentication required.
 */

const GRANTS_GOV_API_URL = 'https://api.grants.gov/v1/api/search2';

export interface GrantsGovSearchParams {
  keyword?: string;
  oppNum?: string;
  oppStatuses?: string; // pipe-separated: "forecasted|posted|closed|archived"
  agencies?: string;
  eligibilities?: string;
  fundingCategories?: string;
  fundingInstruments?: string;
  aln?: string;
  rows?: number;
}

export interface GrantsGovOpportunity {
  id: string;
  number: string;
  title: string;
  agencyCode: string;
  agencyName?: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
  docType?: string;
  alnList?: string[];
}

export interface GrantsGovSearchResult {
  hitCount: number;
  opportunities: GrantsGovOpportunity[];
}

export async function searchGrantsGov(
  params: GrantsGovSearchParams,
): Promise<GrantsGovSearchResult> {
  const body: Record<string, unknown> = {
    rows: params.rows ?? 25,
  };
  if (params.keyword) body.keyword = params.keyword;
  if (params.oppNum) body.oppNum = params.oppNum;
  if (params.oppStatuses) body.oppStatuses = params.oppStatuses;
  else body.oppStatuses = 'forecasted|posted'; // default to open opportunities
  if (params.agencies) body.agencies = params.agencies;
  if (params.eligibilities) body.eligibilities = params.eligibilities;
  if (params.fundingCategories) body.fundingCategories = params.fundingCategories;
  if (params.fundingInstruments) body.fundingInstruments = params.fundingInstruments;
  if (params.aln) body.aln = params.aln;

  const response = await fetch(GRANTS_GOV_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Grants.gov API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json() as {
    errorcode?: number;
    msg?: string;
    data?: {
      hitCount?: number;
      oppHits?: Array<{
        id?: string;
        number?: string;
        title?: string;
        agencyCode?: string;
        openDate?: string;
        closeDate?: string;
        oppStatus?: string;
        docType?: string;
        alnList?: string[];
      }>;
    };
  };

  if (json.errorcode && json.errorcode !== 0) {
    throw new Error(`Grants.gov API error: ${json.msg ?? 'Unknown error'}`);
  }

  const hits = json.data?.oppHits ?? [];

  return {
    hitCount: json.data?.hitCount ?? 0,
    opportunities: hits.map((hit) => ({
      id: hit.id ?? '',
      number: hit.number ?? '',
      title: hit.title ?? '',
      agencyCode: hit.agencyCode ?? '',
      openDate: hit.openDate ?? '',
      closeDate: hit.closeDate ?? '',
      oppStatus: hit.oppStatus ?? '',
      docType: hit.docType ?? '',
      alnList: hit.alnList ?? [],
    })),
  };
}

/** Normalize a date string (e.g. MM/DD/YYYY from Grants.gov) to ISO YYYY-MM-DD. */
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  // Try MM/DD/YYYY format explicitly to avoid UTC offset issues
  const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    return `${parts[3]!}-${parts[1]!.padStart(2, '0')}-${parts[2]!.padStart(2, '0')}`;
  }
  // Fallback: parse as local time
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Map a Grants.gov opportunity to fields suitable for creating a grant record.
 */
export function mapOpportunityToGrant(
  opp: GrantsGovOpportunity,
) {
  return {
    name: opp.title,
    status: 'researching' as const,
    category: 'federal' as const,
    funder_grant_id: opp.number,
    application_due_at: normalizeDate(opp.closeDate) || null,
    application_url: `https://www.grants.gov/search-results-detail/${opp.id}`,
    source_url: `https://www.grants.gov/search-results-detail/${opp.id}`,
    is_discovered: true,
    notes: [
      `Federal Opportunity: ${opp.number}`,
      `Agency: ${opp.agencyCode}${opp.agencyName ? ` (${opp.agencyName})` : ''}`,
      `Status: ${opp.oppStatus}`,
      opp.alnList?.length ? `ALN: ${opp.alnList.join(', ')}` : '',
    ].filter(Boolean).join('\n'),
  };
}
