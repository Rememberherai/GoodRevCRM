import type { ImpactFrameworkTemplate, ImpactDimensionTemplate } from '@/types/community';

export const CCF_DIMENSIONS: ImpactDimensionTemplate[] = [
  {
    key: 'natural',
    label: 'Natural',
    description: 'Land, water, air, biodiversity, environment, and food systems.',
    color: '#22c55e',
    icon: 'Leaf',
    sort_order: 0,
    is_active: true,
  },
  {
    key: 'cultural',
    label: 'Cultural',
    description: 'Heritage, arts, identity, practices, and traditions.',
    color: '#a855f7',
    icon: 'Palette',
    sort_order: 1,
    is_active: true,
  },
  {
    key: 'human',
    label: 'Human',
    description: 'Education, skills, health, and workforce development.',
    color: '#3b82f6',
    icon: 'GraduationCap',
    sort_order: 2,
    is_active: true,
  },
  {
    key: 'social',
    label: 'Social',
    description: 'Relationships, trust, belonging, bonding, and bridging.',
    color: '#f97316',
    icon: 'Handshake',
    sort_order: 3,
    is_active: true,
  },
  {
    key: 'political',
    label: 'Political',
    description: 'Civic engagement, advocacy, representation, and self-organization.',
    color: '#ef4444',
    icon: 'Vote',
    sort_order: 4,
    is_active: true,
  },
  {
    key: 'financial',
    label: 'Financial',
    description: 'Donations, grants, fundraising, and economic resources.',
    color: '#10b981',
    icon: 'DollarSign',
    sort_order: 5,
    is_active: true,
  },
  {
    key: 'built',
    label: 'Built',
    description: 'Facilities, infrastructure, technology, and housing.',
    color: '#64748b',
    icon: 'Hammer',
    sort_order: 6,
    is_active: true,
  },
];

export const VITAL_CONDITIONS_DIMENSIONS: ImpactDimensionTemplate[] = [
  {
    key: 'humility_learning',
    label: 'Humility & Willingness to Learn',
    description: 'A culture of listening, learning, and continuous improvement.',
    color: '#0f766e',
    icon: 'Brain',
    sort_order: 0,
    is_active: true,
  },
  {
    key: 'belonging_civic_muscle',
    label: 'Belonging & Civic Muscle',
    description: 'Connected communities with strong participation and voice.',
    color: '#f59e0b',
    icon: 'Users',
    sort_order: 1,
    is_active: true,
  },
  {
    key: 'thriving_natural_world',
    label: 'Thriving Natural World',
    description: 'Healthy environments and stewardship of natural resources.',
    color: '#16a34a',
    icon: 'TreePine',
    sort_order: 2,
    is_active: true,
  },
  {
    key: 'basic_needs',
    label: 'Basic Needs',
    description: 'Food, housing, safety, and health needs are reliably met.',
    color: '#dc2626',
    icon: 'HeartHandshake',
    sort_order: 3,
    is_active: true,
  },
  {
    key: 'lifelong_learning',
    label: 'Lifelong Learning',
    description: 'Access to learning and growth across the lifespan.',
    color: '#2563eb',
    icon: 'BookOpen',
    sort_order: 4,
    is_active: true,
  },
  {
    key: 'meaningful_work_wealth',
    label: 'Meaningful Work & Wealth',
    description: 'Stable economic opportunity and pathways to prosperity.',
    color: '#7c3aed',
    icon: 'BriefcaseBusiness',
    sort_order: 5,
    is_active: true,
  },
  {
    key: 'reliable_transportation',
    label: 'Reliable Transportation',
    description: 'Dependable mobility that supports connection and opportunity.',
    color: '#0891b2',
    icon: 'Bus',
    sort_order: 6,
    is_active: true,
  },
];

export const FRAMEWORK_TEMPLATES: Record<'ccf' | 'vital_conditions', ImpactFrameworkTemplate> = {
  ccf: {
    type: 'ccf',
    name: 'Community Capitals Framework',
    description: 'Seven forms of community wealth used to track holistic community impact.',
    dimensions: CCF_DIMENSIONS,
  },
  vital_conditions: {
    type: 'vital_conditions',
    name: '7 Vital Conditions for Health and Well-Being',
    description: 'A framework for measuring the conditions communities need to thrive.',
    dimensions: VITAL_CONDITIONS_DIMENSIONS,
  },
};

export function getFrameworkTemplate(type: 'ccf' | 'vital_conditions'): ImpactFrameworkTemplate {
  return FRAMEWORK_TEMPLATES[type];
}

export function getDimensionColorMap(dimensions: ImpactDimensionTemplate[]): Record<string, string> {
  return Object.fromEntries(dimensions.map((dimension) => [dimension.key, dimension.color]));
}

export function getDimensionIconMap(dimensions: ImpactDimensionTemplate[]): Record<string, string> {
  return Object.fromEntries(dimensions.map((dimension) => [dimension.key, dimension.icon]));
}

export function cloneFrameworkToProject(
  framework: ImpactFrameworkTemplate,
  projectId: string,
  idFactory: () => string = () => crypto.randomUUID()
) {
  const frameworkId = idFactory();

  return {
    framework: {
      id: frameworkId,
      project_id: projectId,
      name: framework.name,
      description: framework.description,
      type: framework.type,
      is_active: true,
    },
    dimensions: framework.dimensions.map((dimension) => ({
      id: idFactory(),
      framework_id: frameworkId,
      key: dimension.key,
      label: dimension.label,
      description: dimension.description,
      color: dimension.color,
      icon: dimension.icon,
      sort_order: dimension.sort_order,
      is_active: dimension.is_active,
    })),
  };
}
