import { create } from 'zustand';
import type { Project } from '@/types/project';

interface ProjectState {
  // Current project being viewed
  currentProject: Project | null;

  // All projects for the user
  projects: Project[];

  // Loading states
  isLoading: boolean;
  isLoadingProjects: boolean;

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (slug: string, updates: Partial<Project>) => void;
  removeProject: (slug: string) => void;
  setIsLoading: (loading: boolean) => void;
  setIsLoadingProjects: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  projects: [],
  isLoading: false,
  isLoadingProjects: false,

  setCurrentProject: (project) => set({ currentProject: project }),

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),

  updateProject: (slug, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.slug === slug ? { ...p, ...updates } : p
      ),
      currentProject:
        state.currentProject?.slug === slug
          ? { ...state.currentProject, ...updates }
          : state.currentProject,
    })),

  removeProject: (slug) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.slug !== slug),
      currentProject:
        state.currentProject?.slug === slug ? null : state.currentProject,
    })),

  setIsLoading: (isLoading) => set({ isLoading }),

  setIsLoadingProjects: (isLoadingProjects) => set({ isLoadingProjects }),
}));
