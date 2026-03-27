import { create } from 'zustand';

const STORAGE_KEY_PREFIX = 'goodrev:project-tour:v1:';

interface TourState {
  isActive: boolean;
  startTour: () => void;
  endTour: (projectId: string) => void;
  hasSeen: (projectId: string) => boolean;
  clearSeen: (projectId: string) => void;
}

export const useTourStore = create<TourState>((set) => ({
  isActive: false,
  startTour: () => set({ isActive: true }),
  endTour: (projectId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, 'true');
    }
    set({ isActive: false });
  },
  hasSeen: (projectId: string) => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`) === 'true';
  },
  clearSeen: (projectId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${projectId}`);
    }
  },
}));
