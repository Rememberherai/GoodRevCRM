import type { Step } from 'react-joyride';
import type { ProjectType } from '@/types/project';

interface TourStepDef {
  tourId: string;
  title: string;
  content: string;
}

const standardSteps: TourStepDef[] = [
  { tourId: 'dashboard', title: 'Welcome', content: "Welcome to your Sales CRM! Here's a quick tour of the key areas." },
  { tourId: '/organizations', title: 'Organizations', content: 'Track companies you sell to. Add contacts, notes, and deal history.' },
  { tourId: '/people', title: 'People', content: 'Your contact database. Link people to organizations and track interactions.' },
  { tourId: '/opportunities', title: 'Opportunities', content: 'Your sales pipeline — track deals from lead to close with stages and values.' },
  { tourId: '/rfps', title: 'RFPs', content: 'Monitor and respond to RFP opportunities. Auto-discover municipal RFPs.' },
  { tourId: '/sequences', title: 'Sequences', content: 'Automated multi-step email outreach to engage prospects.' },
  { tourId: '/content-library', title: 'Content Library', content: 'Reusable email templates, proposal snippets, and documents.' },
  { tourId: '/contracts', title: 'Contracts', content: 'Create and manage contracts with e-signature support.' },
  { tourId: '/reports', title: 'Reporting', content: 'Pipeline health, activity analytics, and team performance.' },
  { tourId: '/settings', title: 'Settings', content: 'Configure your project and team. Replay this tour anytime from here.' },
];

const communitySteps: TourStepDef[] = [
  { tourId: 'dashboard', title: 'Welcome', content: "Welcome to your Community Project! Let's walk through the tools." },
  { tourId: '/households', title: 'Households', content: 'Track families and households in your community.' },
  { tourId: '/people', title: 'People', content: 'Individual contacts linked to households.' },
  { tourId: '/organizations', title: 'Organizations', content: 'Partner organizations, funders, and service providers.' },
  { tourId: '/programs-services', title: 'Programs & Services', content: 'Manage community programs, enrollment, and referrals between organizations.' },
  { tourId: '/events', title: 'Events', content: 'Create events with ticketing and QR check-in, manage registrations, and publish a public calendar.' },
  { tourId: '/workforce', title: 'Workforce', content: 'Manage contractors, employees, jobs, and timesheets.' },
  { tourId: '/contributions', title: 'Contributions', content: 'Record donations, volunteer hours, and in-kind gifts.' },
  { tourId: '/grants', title: 'Grants', content: 'Manage grants from discovery through reporting and compliance.' },
  { tourId: '/communications', title: 'Communications', content: 'Send broadcasts, manage sequences, and create email templates.' },
  { tourId: '/assets', title: 'Assets & Map', content: 'Catalog community resources and visualize them on a map.' },
  { tourId: '/reports', title: 'Reporting', content: 'Community analytics, impact reports, and public dashboard.' },
  { tourId: '/settings', title: 'Settings', content: 'Configure your project and team. Replay this tour anytime from here.' },
];

const grantsSteps: TourStepDef[] = [
  { tourId: 'dashboard', title: 'Welcome', content: "Welcome to Grants Management! Here's a quick tour." },
  { tourId: '/grants', title: 'Grants Pipeline', content: 'Track grants from research through award and closeout.' },
  { tourId: '/grants/discover', title: 'Discover', content: 'Search for grant opportunities from Grants.gov and other sources.' },
  { tourId: '/organizations', title: 'Organizations', content: 'Track funders, fiscal sponsors, and partner organizations.' },
  { tourId: '/people', title: 'People', content: 'Manage contacts at funding organizations and program officers.' },
  { tourId: '/content-library', title: 'Content Library', content: 'Reusable proposal templates and supporting documents.' },
  { tourId: '/reports', title: 'Reporting', content: 'Grant analytics, pipeline reports, and compliance tracking.' },
  { tourId: '/settings', title: 'Settings', content: 'Configure your project and team. Replay this tour anytime from here.' },
];

const stepCatalog: Record<ProjectType, TourStepDef[]> = {
  standard: standardSteps,
  community: communitySteps,
  grants: grantsSteps,
};

/**
 * Build tour steps from the catalog, filtering to only those
 * whose data-tour-id element is visible in the DOM.
 */
export function getVisibleTourSteps(projectType: ProjectType): Step[] {
  const catalog = stepCatalog[projectType] ?? standardSteps;
  const steps: Step[] = [];

  for (const def of catalog) {
    if (def.tourId === 'dashboard') {
      // Welcome step — centered overlay, no specific target
      steps.push({
        target: 'body',
        placement: 'center',
        title: def.title,
        content: def.content,
        skipBeacon: true,
      });
      continue;
    }

    // Check if the sidebar element exists in the DOM
    const el = document.querySelector(`[data-tour-id="${def.tourId}"]`);
    if (el) {
      steps.push({
        target: `[data-tour-id="${def.tourId}"]`,
        title: def.title,
        content: def.content,
        skipBeacon: true,
        placement: 'right',
      });
    }
  }

  return steps;
}
