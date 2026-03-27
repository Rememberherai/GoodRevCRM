'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { resolveOverrideFromList } from '@/lib/projects/permissions';

export interface PermissionOverride {
  resource: string;
  granted: boolean;
}

interface PermissionsContextValue {
  overrides: PermissionOverride[];
  role: string | null;
  /** Check if a resource (including dot-notation sub-resources) is denied. */
  isDenied: (resource: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  overrides: [],
  role: null,
  isDenied: () => false,
});

export function PermissionsProvider({
  overrides,
  role,
  children,
}: {
  overrides: PermissionOverride[];
  role: string | null;
  children: ReactNode;
}) {
  const value = useMemo<PermissionsContextValue>(() => ({
    overrides,
    role,
    isDenied: (resource: string) => {
      const result = resolveOverrideFromList(overrides, resource);
      return result === false;
    },
  }), [overrides, role]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
