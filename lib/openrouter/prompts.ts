import type { CustomFieldDefinition } from '@/types/custom-field';
import type { Organization } from '@/types/organization';
import type { Person } from '@/types/person';

// Build JSON schema from custom field definitions for structured output
export function buildCustomFieldsSchema(fields: CustomFieldDefinition[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const field of fields) {
    switch (field.field_type) {
      case 'text':
      case 'textarea':
      case 'url':
      case 'email':
      case 'phone':
        properties[field.name] = { type: ['string', 'null'] };
        break;
      case 'number':
      case 'currency':
      case 'percentage':
      case 'rating':
        properties[field.name] = { type: ['number', 'null'] };
        break;
      case 'boolean':
        properties[field.name] = { type: ['boolean', 'null'] };
        break;
      case 'date':
      case 'datetime':
        properties[field.name] = { type: ['string', 'null'], format: 'date' };
        break;
      case 'select':
        const options = field.options as { value: string; label: string }[];
        properties[field.name] = {
          type: ['string', 'null'],
          enum: options.map(o => o.value),
        };
        break;
      case 'multi_select':
        const multiOptions = field.options as { value: string; label: string }[];
        properties[field.name] = {
          type: ['array', 'null'],
          items: { type: 'string', enum: multiOptions.map(o => o.value) },
        };
        break;
      default:
        properties[field.name] = { type: ['string', 'null'] };
    }
  }

  return {
    type: 'object',
    properties,
    additionalProperties: false,
  };
}

// Extended field definition with AI fields
interface ExtendedCustomFieldDefinition extends CustomFieldDefinition {
  is_ai_extractable?: boolean;
  ai_extraction_hint?: string | null;
  ai_confidence_threshold?: number | null;
}

// Format custom fields for research prompt (with AI extraction hints)
export function formatCustomFieldsForPrompt(fields: CustomFieldDefinition[]): string {
  // Filter to only AI-extractable fields
  const extractableFields = (fields as ExtendedCustomFieldDefinition[]).filter(
    f => f.is_ai_extractable !== false
  );

  if (extractableFields.length === 0) return '';

  const fieldDescriptions = extractableFields.map(field => {
    let description = `- ${field.label} (${field.name}): ${getFieldTypeDescription(field.field_type)}`;

    // Add AI extraction hint if available (prioritize this)
    if (field.ai_extraction_hint) {
      description += `\n  Hint: ${field.ai_extraction_hint}`;
    } else if (field.description) {
      description += ` - ${field.description}`;
    }

    if (field.field_type === 'select' || field.field_type === 'multi_select') {
      const options = field.options as { value: string; label: string }[];
      description += `\n  Valid options: ${options.map(o => o.value).join(', ')}`;
    }

    // Add confidence threshold info
    const threshold = field.ai_confidence_threshold ?? 0.7;
    description += `\n  Required confidence: ${Math.round(threshold * 100)}%`;

    return description;
  });

  return `
Custom fields to extract (only return if confident):
${fieldDescriptions.join('\n')}`;
}

// Get only AI-extractable custom fields
export function getAIExtractableFields(fields: CustomFieldDefinition[]): CustomFieldDefinition[] {
  return (fields as ExtendedCustomFieldDefinition[]).filter(f => f.is_ai_extractable !== false);
}

function getFieldTypeDescription(fieldType: string): string {
  const descriptions: Record<string, string> = {
    text: 'text value',
    textarea: 'longer text description',
    number: 'numeric value',
    currency: 'monetary amount',
    percentage: 'percentage (0-100)',
    date: 'date (YYYY-MM-DD)',
    datetime: 'date and time',
    boolean: 'true or false',
    select: 'single choice from options',
    multi_select: 'multiple choices from options',
    url: 'URL/link',
    email: 'email address',
    phone: 'phone number',
    rating: 'rating (1-5)',
    user: 'user reference',
  };
  return descriptions[fieldType] ?? 'value';
}

// Simple template interpolation (replaces {{variable}} with values)
function interpolateTemplate(
  template: string,
  variables: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value ?? '';
  });
}

// Organization research prompt
export function buildOrganizationResearchPrompt(
  organization: Pick<Organization, 'name' | 'domain' | 'website' | 'industry'>,
  customFields: CustomFieldDefinition[] = [],
  customPromptTemplate?: string
): string {
  const customFieldsSection = formatCustomFieldsForPrompt(customFields);
  const customFieldsSchema = customFields.length > 0
    ? buildCustomFieldsSchema(customFields)
    : null;

  // If custom prompt template is provided, use it
  if (customPromptTemplate) {
    const variables = {
      name: organization.name,
      domain: organization.domain,
      website: organization.website,
      industry: organization.industry,
    };

    let prompt = interpolateTemplate(customPromptTemplate, variables);

    // Add custom fields section if not already in template
    if (customFieldsSection && !prompt.includes('custom_fields')) {
      prompt += `\n${customFieldsSection}`;
    }

    // Build custom_fields example for the JSON schema
    let customFieldsExampleCustom = '{}';
    if (customFields.length > 0) {
      const exampleObj: Record<string, string> = {};
      for (const field of customFields) {
        exampleObj[field.name] = `value for ${field.label}`;
      }
      customFieldsExampleCustom = JSON.stringify(exampleObj);
    }

    prompt += `

Your response MUST be a JSON object with these EXACT field names:
{
  "company_name": "string or null",
  "website": "string or null",
  "industry": "string or null",
  "employee_count": number or null,
  "annual_revenue": "string or null",
  "description": "string or null",
  "headquarters": {"city": "string", "state": "string", "country": "string"} or null,
  "founded_year": number or null,
  "key_products": ["array of strings"] or null,
  "competitors": ["array of strings"] or null,
  "recent_news": [{"title": "string", "date": "string", "summary": "string"}] or null,
  "custom_fields": ${customFieldsExampleCustom},
  "confidence_scores": {"field_name": 0.95, ...}
}

Use null for any fields you cannot determine. Respond ONLY with the JSON object.`;

    return prompt;
  }

  // Default prompt
  let prompt = `You are a business intelligence researcher. Research the following company and provide structured data.

Company Information:
- Name: ${organization.name}
${organization.domain ? `- Domain: ${organization.domain}` : ''}
${organization.website ? `- Website: ${organization.website}` : ''}
${organization.industry ? `- Industry: ${organization.industry}` : ''}

Research and provide the following information:
1. Full company name and any aliases
2. Official website URL
3. Industry classification
4. Approximate employee count
5. Estimated annual revenue (if public or available)
6. Company description/overview
7. Headquarters location (city, state/province, country)
8. Year founded
9. Key products or services (up to 5)
10. Main competitors (up to 5)
11. Recent news or developments (up to 3 items with dates and summaries)
${customFieldsSection}

For each field, provide a confidence score (0-1) indicating how certain you are about the data.`;

  // Build custom_fields example based on actual custom fields
  let customFieldsExample = '{}';
  if (customFields.length > 0) {
    const exampleObj: Record<string, string> = {};
    for (const field of customFields) {
      exampleObj[field.name] = `value for ${field.label}`;
    }
    customFieldsExample = JSON.stringify(exampleObj, null, 4).replace(/\n/g, '\n    ');
  }

  prompt += `

Your response MUST be a JSON object with these EXACT field names:
\`\`\`json
{
  "company_name": "Full legal company name",
  "website": "https://example.com",
  "industry": "Industry classification",
  "employee_count": 50000,
  "annual_revenue": "$50B",
  "description": "Company description and overview...",
  "headquarters": {
    "city": "City name",
    "state": "State or province",
    "country": "Country"
  },
  "founded_year": 2004,
  "key_products": ["Product 1", "Product 2", "Product 3"],
  "competitors": ["Competitor 1", "Competitor 2"],
  "recent_news": [
    {"title": "News headline", "date": "2024-01-15", "summary": "Brief summary of the news..."}
  ],
  "custom_fields": ${customFieldsExample},
  "confidence_scores": {
    "company_name": 0.95,
    "website": 0.9,
    "industry": 0.85
  }
}
\`\`\`

Use null for any fields you cannot determine. Respond ONLY with the JSON object, no additional text.`;

  return prompt;
}

// Person research prompt
export function buildPersonResearchPrompt(
  person: Pick<Person, 'first_name' | 'last_name' | 'email' | 'job_title'>,
  organizationName?: string,
  customFields: CustomFieldDefinition[] = [],
  customPromptTemplate?: string
): string {
  const fullName = `${person.first_name} ${person.last_name}`;
  const customFieldsSection = formatCustomFieldsForPrompt(customFields);
  const customFieldsSchema = customFields.length > 0
    ? buildCustomFieldsSchema(customFields)
    : null;

  // If custom prompt template is provided, use it
  if (customPromptTemplate) {
    const variables = {
      first_name: person.first_name,
      last_name: person.last_name,
      full_name: fullName,
      email: person.email,
      job_title: person.job_title,
      organization_name: organizationName,
    };

    let prompt = interpolateTemplate(customPromptTemplate, variables);

    // Add custom fields section if not already in template
    if (customFieldsSection && !prompt.includes('custom_fields')) {
      prompt += `\n${customFieldsSection}`;
    }

    // Build custom_fields example for the JSON schema
    let customFieldsExampleCustom = '{}';
    if (customFields.length > 0) {
      const exampleObj: Record<string, string> = {};
      for (const field of customFields) {
        exampleObj[field.name] = `value for ${field.label}`;
      }
      customFieldsExampleCustom = JSON.stringify(exampleObj);
    }

    prompt += `

Your response MUST be a JSON object with these EXACT field names:
{
  "full_name": "string or null",
  "current_title": "string or null",
  "current_company": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "linkedin_url": "string or null",
  "location": {"city": "string", "state": "string", "country": "string"} or null,
  "education": [{"institution": "string", "degree": "string", "year": number}] or null,
  "work_history": [{"company": "string", "title": "string", "start_year": number, "end_year": number}] or null,
  "skills": ["array of strings"] or null,
  "bio": "string or null",
  "custom_fields": ${customFieldsExampleCustom},
  "confidence_scores": {"field_name": 0.95, ...}
}

Use null for any fields you cannot determine. Respond ONLY with the JSON object.`;

    return prompt;
  }

  // Default prompt
  let prompt = `You are a professional research analyst. Research the following person and provide structured data.

Person Information:
- Name: ${fullName}
${person.email ? `- Email: ${person.email}` : ''}
${person.job_title ? `- Title: ${person.job_title}` : ''}
${organizationName ? `- Company: ${organizationName}` : ''}

Research and provide the following information:
1. Full name (verify spelling)
2. Current job title
3. Current company/employer
4. Professional email (if publicly available)
5. Business phone (if publicly available)
6. LinkedIn profile URL
7. Location (city, state/province, country)
8. Education history (institution, degree, year)
9. Work history (company, title, years)
10. Professional skills or expertise areas
11. Brief professional bio
${customFieldsSection}

IMPORTANT: Only include publicly available professional information. Do not include personal contact details unless they are published professionally.

For each field, provide a confidence score (0-1) indicating how certain you are about the data.`;

  // Build custom_fields example based on actual custom fields
  let customFieldsExample = '{}';
  if (customFields.length > 0) {
    const exampleObj: Record<string, string> = {};
    for (const field of customFields) {
      exampleObj[field.name] = `value for ${field.label}`;
    }
    customFieldsExample = JSON.stringify(exampleObj, null, 4).replace(/\n/g, '\n    ');
  }

  prompt += `

Your response MUST be a JSON object with these EXACT field names:
\`\`\`json
{
  "full_name": "Full name of the person",
  "current_title": "Current job title",
  "current_company": "Current employer name",
  "email": "professional@email.com",
  "phone": "+1-555-123-4567",
  "linkedin_url": "https://linkedin.com/in/username",
  "location": {
    "city": "City name",
    "state": "State or province",
    "country": "Country"
  },
  "education": [
    {"institution": "University Name", "degree": "Degree Type", "year": 2010}
  ],
  "work_history": [
    {"company": "Company Name", "title": "Job Title", "start_year": 2015, "end_year": 2020}
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "bio": "Brief professional biography...",
  "custom_fields": ${customFieldsExample},
  "confidence_scores": {
    "full_name": 0.95,
    "current_title": 0.9,
    "current_company": 0.85
  }
}
\`\`\`

Use null for any fields you cannot determine. Respond ONLY with the JSON object, no additional text.`;

  return prompt;
}

// RFP analysis prompt
export function buildRfpAnalysisPrompt(
  rfpContent: string,
  organizationContext?: string
): string {
  return `You are an RFP (Request for Proposal) analyst. Analyze the following RFP document and extract key information.

${organizationContext ? `Organization Context:\n${organizationContext}\n\n` : ''}RFP Content:
${rfpContent}

Extract and provide:
1. RFP title/project name
2. Issuing organization
3. Due date/deadline
4. Estimated budget or value range
5. Key requirements (list up to 10)
6. Evaluation criteria (if specified)
7. Submission requirements
8. Contact information
9. Timeline/milestones
10. Recommended go/no-go factors

Also provide:
- A brief summary (2-3 sentences)
- Key strengths for our organization
- Potential challenges or concerns
- Recommended next steps

Respond with valid JSON matching the expected structure.`;
}

// Opportunity qualification prompt
export function buildOpportunityQualificationPrompt(
  opportunityDetails: string,
  organizationContext?: string
): string {
  return `You are a sales opportunity qualification expert. Analyze the following opportunity and provide qualification insights.

${organizationContext ? `Our Organization:\n${organizationContext}\n\n` : ''}Opportunity Details:
${opportunityDetails}

Analyze and provide:
1. Qualification score (0-100)
2. Deal strength assessment (weak/moderate/strong)
3. Key buying signals identified
4. Potential blockers or red flags
5. Recommended next actions (list 3-5)
6. Stakeholder analysis (if information available)
7. Competitive positioning insights
8. Timeline assessment
9. Budget/value estimate confidence
10. Win probability estimate (0-100%)

Respond with valid JSON matching the expected structure.`;
}

// Email generation prompt
export function buildEmailGenerationPrompt(
  context: {
    recipientName: string;
    recipientTitle?: string;
    companyName?: string;
    purpose: string;
    tone: 'formal' | 'professional' | 'casual';
    previousInteraction?: string;
    keyPoints?: string[];
    senderName: string;
    senderTitle?: string;
    senderCompany?: string;
  }
): string {
  const {
    recipientName,
    recipientTitle,
    companyName,
    purpose,
    tone,
    previousInteraction,
    keyPoints,
    senderName,
    senderTitle,
    senderCompany,
  } = context;

  let prompt = `Write a ${tone} business email with the following details:

Recipient: ${recipientName}${recipientTitle ? `, ${recipientTitle}` : ''}${companyName ? ` at ${companyName}` : ''}
Sender: ${senderName}${senderTitle ? `, ${senderTitle}` : ''}${senderCompany ? ` at ${senderCompany}` : ''}
Purpose: ${purpose}
Tone: ${tone}`;

  if (previousInteraction) {
    prompt += `\nPrevious interaction: ${previousInteraction}`;
  }

  if (keyPoints && keyPoints.length > 0) {
    prompt += `\nKey points to include:\n${keyPoints.map(p => `- ${p}`).join('\n')}`;
  }

  prompt += `

Generate:
1. Subject line (concise, action-oriented)
2. Email body (professional, clear, with appropriate greeting and sign-off)

Respond with JSON containing "subject" and "body" fields.`;

  return prompt;
}
