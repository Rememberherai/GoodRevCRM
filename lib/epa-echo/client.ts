import { z } from 'zod';

// EPA ECHO API configuration
const EPA_ECHO_BASE_URL = 'https://echodata.epa.gov/echo';

// Response schemas for EPA ECHO CWA REST Services
// Note: EPA returns numbers as strings in JSON responses
const facilitiesQueryResponseSchema = z.object({
  Results: z.object({
    QueryID: z.string(),
    QueryRows: z.string().transform(Number).optional(),
  }),
});

const facilitySchema = z.object({
  CWPName: z.string().nullable().optional(),
  SourceID: z.string().nullable().optional(),
  CWPCity: z.string().nullable().optional(),
  CWPState: z.string().nullable().optional(),
  CWPZip: z.string().nullable().optional(),
  CWPStreet: z.string().nullable().optional(),
  CWPCounty: z.string().nullable().optional(),
  CWPFacilityTypeIndicator: z.string().nullable().optional(),
  CWPTotalDesignFlowNmbr: z.union([z.string(), z.number()]).nullable().optional(),
  CWPActualAverageFlowNmbr: z.union([z.string(), z.number()]).nullable().optional(),
  FacLat: z.union([z.string(), z.number()]).nullable().optional(),
  FacLong: z.union([z.string(), z.number()]).nullable().optional(),
});

const qidResponseSchema = z.object({
  Results: z.object({
    Facilities: z.array(facilitySchema).optional(),
    PageNo: z.string().transform(Number).optional(),
    QueryRows: z.string().transform(Number).optional(),
  }),
});

export type EPAFacilityRaw = z.infer<typeof facilitySchema>;
export type EPAQueryResponse = z.infer<typeof facilitiesQueryResponseSchema>;
export type EPAQidResponse = z.infer<typeof qidResponseSchema>;

// Normalized facility type for internal use
export interface EPAFacility {
  permit_id: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  street: string | null;
  county: string | null;
  facility_type: string | null;
  design_flow_mgd: number | null;
  actual_flow_mgd: number | null;
  latitude: number | null;
  longitude: number | null;
}

// Error class
export class EPAEchoError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'EPAEchoError';
  }
}

// Query options
export interface EPAQueryOptions {
  state?: string; // Two-letter state code
  minDesignFlow?: number; // Minimum design flow in MGD
  pageSize?: number; // Results per page (max 10000)
}

// Normalize a raw facility record
function normalizeFacility(raw: EPAFacilityRaw): EPAFacility {
  const parseNumber = (val: string | number | null | undefined): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? null : num;
  };

  return {
    permit_id: raw.SourceID ?? null,
    name: raw.CWPName ?? null,
    city: raw.CWPCity ?? null,
    state: raw.CWPState ?? null,
    zip: raw.CWPZip ?? null,
    street: raw.CWPStreet ?? null,
    county: raw.CWPCounty ?? null,
    facility_type: raw.CWPFacilityTypeIndicator ?? null,
    design_flow_mgd: parseNumber(raw.CWPTotalDesignFlowNmbr),
    actual_flow_mgd: parseNumber(raw.CWPActualAverageFlowNmbr),
    latitude: parseNumber(raw.FacLat),
    longitude: parseNumber(raw.FacLong),
  };
}

export class EPAEchoClient {
  private async request<T>(
    endpoint: string,
    params: Record<string, string>,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    const url = new URL(`${EPA_ECHO_BASE_URL}${endpoint}`);
    url.searchParams.set('output', 'JSON');
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unable to read response';
      }
      throw new EPAEchoError(
        `EPA ECHO API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    const data = await response.json();

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      console.error('EPA ECHO response validation failed:', parsed.error);
      throw new EPAEchoError(
        'Invalid response from EPA ECHO API',
        undefined,
        { data, errors: parsed.error.flatten() }
      );
    }

    return parsed.data;
  }

  /**
   * Step 1: Create a query and get a QID
   * Uses EPA ECHO CWA facility search
   */
  async queryFacilities(options: EPAQueryOptions): Promise<{ qid: string; totalRows: number }> {
    const params: Record<string, string> = {
      // Request POTW facilities (Publicly Owned Treatment Works)
      p_ptype: 'POT',
      // Request specific columns
      p_qcolumns: [
        'CWPName',
        'SourceID',
        'CWPCity',
        'CWPState',
        'CWPZip',
        'CWPStreet',
        'CWPCounty',
        'CWPFacilityTypeIndicator',
        'CWPTotalDesignFlowNmbr',
        'CWPActualAverageFlowNmbr',
        'FacLat',
        'FacLong',
      ].join(','),
    };

    if (options.state) {
      params.p_st = options.state;
    }

    if (options.minDesignFlow !== undefined && options.minDesignFlow > 0) {
      params.p_dession = String(options.minDesignFlow);
    }

    const result = await this.request(
      '/cwa_rest_services.get_facilities',
      params,
      facilitiesQueryResponseSchema
    );

    return {
      qid: result.Results.QueryID,
      totalRows: result.Results.QueryRows ?? 0,
    };
  }

  /**
   * Step 2: Retrieve paged results using QID
   */
  async getQueryResults(
    qid: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<{ facilities: EPAFacility[]; totalRows: number; pageNo: number }> {
    const result = await this.request(
      '/cwa_rest_services.get_qid',
      {
        qid,
        pageno: String(page),
        rpp: String(pageSize), // rows per page
      },
      qidResponseSchema
    );

    const rawFacilities = result.Results.Facilities ?? [];
    const facilities = rawFacilities.map(normalizeFacility);

    return {
      facilities,
      totalRows: result.Results.QueryRows ?? 0,
      pageNo: result.Results.PageNo ?? page,
    };
  }

  /**
   * Fetch all facilities with pagination handling
   * Filters to POTWs and sorts by design flow
   */
  async fetchAllFacilities(
    options: EPAQueryOptions,
    maxResults: number = 250,
    onProgress?: (fetched: number, total: number) => void
  ): Promise<EPAFacility[]> {
    // Step 1: Get QID
    const { qid, totalRows } = await this.queryFacilities(options);

    if (totalRows === 0) {
      return [];
    }

    const facilities: EPAFacility[] = [];
    let page = 1;
    const pageSize = Math.min(options.pageSize ?? 100, 1000);
    const targetCount = Math.min(maxResults, totalRows);

    // Step 2: Fetch pages until we have enough results
    while (facilities.length < targetCount) {
      const result = await this.getQueryResults(qid, page, pageSize);

      // Filter to only include facilities with design flow data (quality filter)
      const validFacilities = result.facilities.filter(f =>
        f.name &&
        f.permit_id
      );

      facilities.push(...validFacilities);

      onProgress?.(Math.min(facilities.length, targetCount), targetCount);

      if (result.facilities.length < pageSize) {
        // No more pages
        break;
      }

      page++;

      // Safety limit to avoid infinite loops
      if (page > 100) {
        console.warn('EPA fetch hit page limit');
        break;
      }
    }

    // Sort by design flow (descending) and take top N
    const sorted = facilities
      .sort((a, b) => (b.design_flow_mgd ?? 0) - (a.design_flow_mgd ?? 0))
      .slice(0, maxResults);

    return sorted;
  }
}

// Singleton instance for server-side usage
let clientInstance: EPAEchoClient | null = null;

export function getEPAEchoClient(): EPAEchoClient {
  if (!clientInstance) {
    clientInstance = new EPAEchoClient();
  }
  return clientInstance;
}

// Helper to create a new client (useful for testing)
export function createEPAEchoClient(): EPAEchoClient {
  return new EPAEchoClient();
}
