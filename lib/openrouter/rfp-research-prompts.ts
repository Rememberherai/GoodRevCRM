import type { RfpResearchContext } from '@/types/rfp-research';

export function buildRfpResearchPrompt(context: RfpResearchContext): string {
  const { rfp, organization, additional_context } = context;

  const rfpInfo = [
    `RFP Title: ${rfp.title}`,
    rfp.rfp_number ? `RFP Number: ${rfp.rfp_number}` : null,
    rfp.description ? `Description: ${rfp.description}` : null,
    rfp.estimated_value ? `Estimated Value: $${rfp.estimated_value.toLocaleString()}` : null,
    rfp.due_date ? `Due Date: ${rfp.due_date}` : null,
    rfp.submission_method ? `Submission Method: ${rfp.submission_method}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const orgInfo = organization
    ? [
        `Organization Name: ${organization.name}`,
        organization.domain ? `Domain: ${organization.domain}` : null,
        organization.industry ? `Industry: ${organization.industry}` : null,
        organization.description ? `Description: ${organization.description}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : 'No issuing organization specified';

  return `You are a competitive intelligence analyst helping a company prepare for an RFP (Request for Proposal) response. Your task is to research and gather comprehensive intelligence about this RFP opportunity.

## RFP Information
${rfpInfo}

## Issuing Organization
${orgInfo}

${additional_context ? `## Additional Context\n${additional_context}\n` : ''}

## Research Instructions

Conduct thorough research and provide findings in the following areas. Be specific and cite sources for all information. If you cannot find reliable information for a section, indicate that clearly.

1. **Organization Profile**: Research the issuing organization's background, size, leadership, recent initiatives, and procurement history.

2. **Industry Context**: Analyze the industry this RFP relates to, including market trends, size, and regulatory environment.

3. **Competitor Analysis**: Identify likely competitors who may bid on this RFP, their strengths, and recent wins in similar contracts.

4. **Similar Contracts**: Find similar RFPs or contracts from this organization or industry to understand typical terms, values, and outcomes.

5. **Key Decision Makers**: Identify individuals likely involved in the evaluation process, their roles, and relevant background.

6. **News & Press**: Find recent news articles, press releases, or announcements relevant to the organization or this opportunity.

7. **Compliance Context**: Research any regulatory requirements, certifications, or compliance standards relevant to this RFP.

8. **Market Intelligence**: Provide insights on pricing benchmarks, typical contract lengths, and evaluation criteria for similar opportunities.

## Response Format

Provide your response as a JSON object with the following structure:

{
  "organization_profile": {
    "overview": "Brief overview of the organization",
    "headquarters": "Location",
    "employee_count": "Approximate number or range",
    "annual_budget": "If available for government/public orgs",
    "leadership": [{"name": "Name", "title": "Title", "relevance": "Why relevant"}],
    "recent_initiatives": ["Initiative 1", "Initiative 2"],
    "procurement_history": "Summary of procurement patterns"
  },
  "industry_context": {
    "market_overview": "Overview of the relevant market",
    "trends": ["Trend 1", "Trend 2"],
    "market_size": "Market size if available",
    "regulatory_environment": "Key regulations"
  },
  "competitor_analysis": {
    "likely_bidders": [
      {"name": "Company", "likelihood": "high|medium|low", "strengths": ["strength1"], "recent_wins": ["contract1"]}
    ],
    "competitive_landscape": "Overall competitive summary"
  },
  "similar_contracts": [
    {"title": "Contract name", "issuer": "Issuing org", "value": "$X", "winner": "Winner if known", "date": "Date", "relevance": "Why relevant"}
  ],
  "key_decision_makers": [
    {"name": "Name", "title": "Title", "role_in_decision": "Their role", "linkedin_url": "URL if found"}
  ],
  "news_and_press": [
    {"title": "Article title", "source": "Publication", "date": "Date", "summary": "Brief summary", "relevance": "Why relevant", "url": "Full URL"}
  ],
  "compliance_context": {
    "relevant_regulations": ["Regulation 1"],
    "certifications_required": ["Cert 1"],
    "compliance_notes": "Additional notes"
  },
  "market_intelligence": {
    "pricing_benchmarks": "Typical pricing for similar work",
    "typical_contract_length": "Common contract terms",
    "evaluation_criteria_insights": "How similar RFPs are typically evaluated"
  },
  "executive_summary": "A 2-3 paragraph summary of the most important findings and strategic recommendations",
  "key_insights": [
    "Key insight 1",
    "Key insight 2",
    "Key insight 3"
  ],
  "recommended_actions": [
    "Recommended action 1",
    "Recommended action 2",
    "Recommended action 3"
  ],
  "sources": [
    {"url": "https://...", "title": "Source title", "domain": "example.com", "snippet": "Brief excerpt", "section": "organization_profile"}
  ]
}

Important:
- Include all source URLs in the "sources" array with the section they relate to
- Use null for any fields where you cannot find reliable information
- Be factual and avoid speculation - clearly indicate uncertainty
- For news items, always include the full URL
- Provide at least 3 key insights and 3 recommended actions`;
}

// Use Claude for research - reliable JSON output
export const RFP_RESEARCH_MODEL = 'anthropic/claude-3.5-sonnet';
