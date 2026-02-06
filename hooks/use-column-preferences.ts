'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { EntityType, CustomFieldDefinition } from '@/types/custom-field';
import type { ColumnConfig, ResolvedColumn } from '@/types/table-columns';
import {
  getColumnsWithCustomFields,
  getDefaultColumnConfig,
} from '@/lib/table-columns/definitions';

interface UseColumnPreferencesOptions {
  customFields?: CustomFieldDefinition[];
}

export function useColumnPreferences(
  entityType: EntityType,
  options: UseColumnPreferencesOptions = {}
) {
  const params = useParams();
  const projectSlug = params.slug as string;
  const { customFields = [] } = options;

  const [preferences, setPreferences] = useState<ColumnConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Debounce timer for saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get all available columns (system + custom fields)
  const availableColumns = useMemo(() => {
    return getColumnsWithCustomFields(entityType, customFields);
  }, [entityType, customFields]);

  // Merge user preferences with column definitions to get resolved columns
  const resolvedColumns = useMemo((): ResolvedColumn[] => {
    // Create a map of preferences by key
    const prefsMap = new Map(preferences.map(p => [p.key, p]));

    // If no preferences yet, use defaults
    if (preferences.length === 0 && !hasLoaded) {
      // Return loading state - all columns hidden
      return availableColumns.map((col, index) => ({
        ...col,
        visible: col.defaultVisible ?? false,
        order: index,
      }));
    }

    // Merge definitions with preferences
    const merged: ResolvedColumn[] = availableColumns.map((col, index) => {
      const pref = prefsMap.get(col.key);
      return {
        ...col,
        visible: pref?.visible ?? col.defaultVisible ?? false,
        order: pref?.order ?? index,
        width: pref?.width,
      };
    });

    // Sort by order
    merged.sort((a, b) => a.order - b.order);

    return merged;
  }, [preferences, availableColumns, hasLoaded]);

  // Get only visible columns for rendering
  const visibleColumns = useMemo(() => {
    return resolvedColumns.filter(c => c.visible);
  }, [resolvedColumns]);

  // Load preferences from API
  const loadPreferences = useCallback(async () => {
    if (!projectSlug) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/column-preferences?entity_type=${entityType}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch column preferences');
      }

      const data = await response.json();

      if (data.preferences?.columns) {
        setPreferences(data.preferences.columns);
      } else if (data.defaults) {
        // No saved preferences, use defaults
        setPreferences(data.defaults);
      }
    } catch (error) {
      console.error('Error loading column preferences:', error);
      // Fall back to defaults
      setPreferences(getDefaultColumnConfig(entityType));
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [projectSlug, entityType]);

  // Save preferences to API (debounced)
  const savePreferences = useCallback(
    async (columns: ColumnConfig[], immediate = false) => {
      if (!projectSlug) return;

      // Cancel pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const doSave = async () => {
        setIsSaving(true);
        try {
          const response = await fetch(
            `/api/projects/${projectSlug}/column-preferences`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entity_type: entityType,
                columns,
              }),
            }
          );

          if (!response.ok) {
            throw new Error('Failed to save column preferences');
          }
        } catch (error) {
          console.error('Error saving column preferences:', error);
        } finally {
          setIsSaving(false);
        }
      };

      if (immediate) {
        await doSave();
      } else {
        // Debounce save by 500ms
        saveTimeoutRef.current = setTimeout(doSave, 500);
      }
    },
    [projectSlug, entityType]
  );

  // Toggle column visibility
  const toggleColumn = useCallback(
    (key: string) => {
      setPreferences(prev => {
        const updated = prev.map(p =>
          p.key === key ? { ...p, visible: !p.visible } : p
        );

        // If column doesn't exist in preferences, add it
        const exists = prev.some(p => p.key === key);
        if (!exists) {
          updated.push({
            key,
            visible: true,
            order: prev.length,
          });
        }

        // Save immediately for toggle actions
        savePreferences(updated, true);
        return updated;
      });
    },
    [availableColumns, savePreferences]
  );

  // Reorder columns
  const reorderColumns = useCallback(
    (fromIndex: number, toIndex: number) => {
      setPreferences(prev => {
        const updated = [...prev];
        const [removed] = updated.splice(fromIndex, 1);
        if (removed) {
          updated.splice(toIndex, 0, removed);
        }

        // Update order values
        const reordered = updated.map((col, index) => ({
          ...col,
          order: index,
        }));

        // Debounce save for reorder actions
        savePreferences(reordered);
        return reordered;
      });
    },
    [savePreferences]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const defaults = getDefaultColumnConfig(entityType);
    setPreferences(defaults);
    savePreferences(defaults, true);
  }, [entityType, savePreferences]);

  // Set column width
  const setColumnWidth = useCallback(
    (key: string, width: number) => {
      setPreferences(prev => {
        const updated = prev.map(p =>
          p.key === key ? { ...p, width } : p
        );

        // Debounce save for width changes
        savePreferences(updated);
        return updated;
      });
    },
    [savePreferences]
  );

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // All resolved columns (for column picker)
    allColumns: resolvedColumns,
    // Only visible columns (for table rendering)
    columns: visibleColumns,
    // Available column definitions (for reference)
    columnDefinitions: availableColumns,
    // Raw preferences
    preferences,
    // Loading states
    isLoading,
    isSaving,
    // Actions
    toggleColumn,
    reorderColumns,
    resetToDefaults,
    setColumnWidth,
    refresh: loadPreferences,
  };
}
