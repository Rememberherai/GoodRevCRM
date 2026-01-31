import { create } from 'zustand';
import type {
  CustomFieldDefinition,
  EntityType,
} from '@/types/custom-field';

interface CustomFieldState {
  // Data
  fields: CustomFieldDefinition[];
  fieldsByEntity: Record<EntityType, CustomFieldDefinition[]>;

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedEntityType: EntityType;

  // Actions
  setFields: (fields: CustomFieldDefinition[]) => void;
  addField: (field: CustomFieldDefinition) => void;
  updateField: (id: string, updates: Partial<CustomFieldDefinition>) => void;
  removeField: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedEntityType: (entityType: EntityType) => void;
  getFieldsForEntity: (entityType: EntityType) => CustomFieldDefinition[];
  reorderFields: (entityType: EntityType, fieldOrders: { id: string; display_order: number }[]) => void;
  reset: () => void;
}

const initialState = {
  fields: [],
  fieldsByEntity: {
    organization: [],
    person: [],
    opportunity: [],
    rfp: [],
  },
  isLoading: false,
  error: null,
  selectedEntityType: 'organization' as EntityType,
};

// Helper to group fields by entity type
function groupFieldsByEntity(fields: CustomFieldDefinition[]): Record<EntityType, CustomFieldDefinition[]> {
  const grouped: Record<EntityType, CustomFieldDefinition[]> = {
    organization: [],
    person: [],
    opportunity: [],
    rfp: [],
  };

  for (const field of fields) {
    if (grouped[field.entity_type]) {
      grouped[field.entity_type].push(field);
    }
  }

  // Sort each group by display_order
  for (const entityType of Object.keys(grouped) as EntityType[]) {
    grouped[entityType].sort((a, b) => a.display_order - b.display_order);
  }

  return grouped;
}

export const useCustomFieldStore = create<CustomFieldState>((set, get) => ({
  ...initialState,

  setFields: (fields) => {
    const fieldsByEntity = groupFieldsByEntity(fields);
    set({ fields, fieldsByEntity, isLoading: false });
  },

  addField: (field) => {
    set((state) => {
      const fields = [...state.fields, field];
      const fieldsByEntity = groupFieldsByEntity(fields);
      return { fields, fieldsByEntity };
    });
  },

  updateField: (id, updates) => {
    set((state) => {
      const fields = state.fields.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      );
      const fieldsByEntity = groupFieldsByEntity(fields);
      return { fields, fieldsByEntity };
    });
  },

  removeField: (id) => {
    set((state) => {
      const fields = state.fields.filter((f) => f.id !== id);
      const fieldsByEntity = groupFieldsByEntity(fields);
      return { fields, fieldsByEntity };
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  setSelectedEntityType: (entityType) => set({ selectedEntityType: entityType }),

  getFieldsForEntity: (entityType) => {
    return get().fieldsByEntity[entityType] ?? [];
  },

  reorderFields: (_entityType, fieldOrders) => {
    set((state) => {
      const fields = state.fields.map((f) => {
        const order = fieldOrders.find((o) => o.id === f.id);
        if (order) {
          return { ...f, display_order: order.display_order };
        }
        return f;
      });
      const fieldsByEntity = groupFieldsByEntity(fields);
      return { fields, fieldsByEntity };
    });
  },

  reset: () => set(initialState),
}));

// API functions
export async function fetchCustomFields(projectSlug: string): Promise<CustomFieldDefinition[]> {
  const response = await fetch(`/api/projects/${projectSlug}/schema`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to fetch custom fields');
  }
  const data = await response.json();
  return data.fields;
}

export async function fetchCustomFieldsForEntity(
  projectSlug: string,
  entityType: EntityType
): Promise<CustomFieldDefinition[]> {
  const response = await fetch(`/api/projects/${projectSlug}/schema?entityType=${entityType}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to fetch custom fields');
  }
  const data = await response.json();
  return data.fields;
}

export async function createCustomField(
  projectSlug: string,
  data: Record<string, unknown>
): Promise<CustomFieldDefinition> {
  const response = await fetch(`/api/projects/${projectSlug}/schema`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to create custom field');
  }
  const result = await response.json();
  return result.field;
}

export async function updateCustomField(
  projectSlug: string,
  fieldId: string,
  data: Partial<CustomFieldDefinition>
): Promise<CustomFieldDefinition> {
  const response = await fetch(`/api/projects/${projectSlug}/schema/${fieldId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to update custom field');
  }
  const result = await response.json();
  return result.field;
}

export async function deleteCustomField(
  projectSlug: string,
  fieldId: string
): Promise<void> {
  const response = await fetch(`/api/projects/${projectSlug}/schema/${fieldId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to delete custom field');
  }
}

export async function reorderCustomFields(
  projectSlug: string,
  fieldOrders: { id: string; display_order: number }[]
): Promise<void> {
  const response = await fetch(`/api/projects/${projectSlug}/schema/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_orders: fieldOrders }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to reorder fields');
  }
}
