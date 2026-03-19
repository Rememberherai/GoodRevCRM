'use client';

import { createContext, useContext } from 'react';

interface CalendarContextValue {
  selectedProjectId: string | null;
  profileSlug: string | null;
}

const CalendarContext = createContext<CalendarContextValue>({
  selectedProjectId: null,
  profileSlug: null,
});

export function CalendarProvider({
  selectedProjectId,
  profileSlug,
  children,
}: CalendarContextValue & { children: React.ReactNode }) {
  return (
    <CalendarContext.Provider value={{ selectedProjectId, profileSlug }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarContext() {
  return useContext(CalendarContext);
}
