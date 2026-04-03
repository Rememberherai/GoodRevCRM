export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'between'
  | 'in'
  | 'ilike'
  | 'is_null'
  | 'is_not_null';

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface DateRangeValue {
  from: string;
  to: string;
}

export type FilterCategory = 'date' | 'boolean' | 'select' | 'text';

export interface FilterDefinition {
  field: string;
  label: string;
  category: FilterCategory;
  group?: string;
  options?: Array<{ label: string; value: string }>;
}

// People filter definitions
export function getPeopleFilterDefinitions(
  dispositionOptions: Array<{ label: string; value: string }>
): FilterDefinition[] {
  return [
    // Date filters
    { field: 'created_at', label: 'Created date', category: 'date', group: 'Dates' },
    { field: 'updated_at', label: 'Updated date', category: 'date', group: 'Dates' },

    // Select filters
    { field: 'disposition_id', label: 'Disposition', category: 'select', group: 'Status', options: dispositionOptions },

    // Boolean filters
    { field: 'is_contractor', label: 'Is contractor', category: 'boolean', group: 'Flags' },
    { field: 'is_employee', label: 'Is employee', category: 'boolean', group: 'Flags' },

    // Text/location filters
    { field: 'address_city', label: 'City', category: 'text', group: 'Location' },
    { field: 'address_state', label: 'State', category: 'text', group: 'Location' },
    { field: 'address_country', label: 'Country', category: 'text', group: 'Location' },

    // Cross-entity (org) filters
    { field: 'org.industry', label: 'Org industry', category: 'text', group: 'Organization' },
    { field: 'org.is_customer', label: 'Org is customer', category: 'boolean', group: 'Organization' },
    { field: 'org.is_vendor', label: 'Org is vendor', category: 'boolean', group: 'Organization' },
    { field: 'org.is_referral_partner', label: 'Org is referral partner', category: 'boolean', group: 'Organization' },
    { field: 'org.address_state', label: 'Org state', category: 'text', group: 'Organization' },
    { field: 'org.address_city', label: 'Org city', category: 'text', group: 'Organization' },
  ];
}

// Organization filter definitions
export function getOrganizationFilterDefinitions(
  dispositionOptions: Array<{ label: string; value: string }>
): FilterDefinition[] {
  return [
    // Date filters
    { field: 'created_at', label: 'Created date', category: 'date', group: 'Dates' },
    { field: 'updated_at', label: 'Updated date', category: 'date', group: 'Dates' },

    // Select filters
    { field: 'disposition_id', label: 'Disposition', category: 'select', group: 'Status', options: dispositionOptions },

    // Boolean filters
    { field: 'is_customer', label: 'Is customer', category: 'boolean', group: 'Flags' },
    { field: 'is_vendor', label: 'Is vendor', category: 'boolean', group: 'Flags' },
    { field: 'is_referral_partner', label: 'Is referral partner', category: 'boolean', group: 'Flags' },

    // Text/location filters
    { field: 'industry', label: 'Industry', category: 'text', group: 'Details' },
    { field: 'address_city', label: 'City', category: 'text', group: 'Location' },
    { field: 'address_state', label: 'State', category: 'text', group: 'Location' },
    { field: 'address_country', label: 'Country', category: 'text', group: 'Location' },
  ];
}
