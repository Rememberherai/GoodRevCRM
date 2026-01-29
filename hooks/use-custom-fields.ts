'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  useCustomFieldStore,
  fetchCustomFields,
  fetchCustomFieldsForEntity,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
} from '@/stores/custom-field';
import type { EntityType } from '@/types/custom-field';
import type { CreateCustomFieldDefinitionInput, UpdateCustomFieldDefinitionInput } from '@/lib/validators/custom-field';

export function useCustomFields() {
  const params = useParams();
  const slug = params?.slug as string;
  const fetchedRef = useRef(false);

  const {
    fields,
    fieldsByEntity,
    isLoading,
    error,
    selectedEntityType,
    setFields,
    addField,
    updateField: updateFieldInStore,
    removeField,
    setLoading,
    setError,
    setSelectedEntityType,
    getFieldsForEntity,
    reorderFields: reorderFieldsInStore,
    reset,
  } = useCustomFieldStore();

  // Fetch all custom fields for the project
  const fetch = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    try {
      const fetchedFields = await fetchCustomFields(slug);
      setFields(fetchedFields);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch custom fields';
      setError(message);
      toast.error(message);
    }
  }, [slug, setFields, setLoading, setError]);

  // Fetch custom fields for a specific entity type
  const fetchForEntity = useCallback(
    async (entityType: EntityType) => {
      if (!slug) return [];

      setLoading(true);
      setError(null);

      try {
        const fetchedFields = await fetchCustomFieldsForEntity(slug, entityType);
        return fetchedFields;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch custom fields';
        setError(message);
        toast.error(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [slug, setLoading, setError]
  );

  // Create a new custom field
  const create = useCallback(
    async (data: CreateCustomFieldDefinitionInput) => {
      if (!slug) return;

      setLoading(true);
      setError(null);

      try {
        const newField = await createCustomField(slug, data);
        addField(newField);
        toast.success('Custom field created');
        return newField;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create custom field';
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [slug, addField, setLoading, setError]
  );

  // Update an existing custom field
  const update = useCallback(
    async (id: string, data: UpdateCustomFieldDefinitionInput) => {
      if (!slug) return;

      setLoading(true);
      setError(null);

      try {
        const updatedField = await updateCustomField(slug, id, data);
        updateFieldInStore(id, updatedField);
        toast.success('Custom field updated');
        return updatedField;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update custom field';
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [slug, updateFieldInStore, setLoading, setError]
  );

  // Delete a custom field
  const remove = useCallback(
    async (id: string) => {
      if (!slug) return;

      setLoading(true);
      setError(null);

      try {
        await deleteCustomField(slug, id);
        removeField(id);
        toast.success('Custom field deleted');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete custom field';
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [slug, removeField, setLoading, setError]
  );

  // Reorder custom fields
  const reorder = useCallback(
    async (entityType: EntityType, fieldOrders: { id: string; display_order: number }[]) => {
      if (!slug) return;

      // Optimistic update
      reorderFieldsInStore(entityType, fieldOrders);

      try {
        await reorderCustomFields(slug, fieldOrders);
      } catch (err) {
        // Revert on error - refetch
        await fetch();
        const message = err instanceof Error ? err.message : 'Failed to reorder fields';
        toast.error(message);
        throw err;
      }
    },
    [slug, reorderFieldsInStore, fetch]
  );

  // Initial fetch
  useEffect(() => {
    if (slug && !fetchedRef.current) {
      fetchedRef.current = true;
      fetch();
    }
  }, [slug, fetch]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      fetchedRef.current = false;
    };
  }, []);

  return {
    // Data
    fields,
    fieldsByEntity,
    selectedEntityType,
    isLoading,
    error,

    // Actions
    fetch,
    fetchForEntity,
    create,
    update,
    remove,
    reorder,
    setSelectedEntityType,
    getFieldsForEntity,
    reset,
  };
}

// Hook for getting custom fields for a specific entity type (simpler interface)
export function useEntityCustomFields(entityType: EntityType) {
  const { fieldsByEntity, isLoading, error, fetchForEntity } = useCustomFields();

  const fields = fieldsByEntity[entityType] ?? [];

  const refetch = useCallback(() => {
    return fetchForEntity(entityType);
  }, [entityType, fetchForEntity]);

  return {
    fields,
    isLoading,
    error,
    refetch,
  };
}

// Hook for building dynamic validation schema based on custom fields
export function useCustomFieldValidation(entityType: EntityType) {
  const { fields } = useEntityCustomFields(entityType);

  // Returns field definitions that can be used to build dynamic Zod schemas
  // This is useful for forms that need to validate custom field values
  return {
    fields,
    requiredFields: fields.filter((f) => f.is_required),
    optionalFields: fields.filter((f) => !f.is_required),
  };
}
