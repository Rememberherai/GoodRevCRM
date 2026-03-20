import { describe, expect, it } from 'vitest';
import {
  CCF_DIMENSIONS,
  FRAMEWORK_TEMPLATES,
  cloneFrameworkToProject,
  getDimensionColorMap,
  getDimensionIconMap,
  getFrameworkTemplate,
} from '@/lib/community/frameworks';

describe('Community Framework Utilities', () => {
  it('exposes the built-in framework templates', () => {
    expect(getFrameworkTemplate('ccf').dimensions).toHaveLength(7);
    expect(FRAMEWORK_TEMPLATES.vital_conditions.dimensions).toHaveLength(7);
  });

  it('builds color and icon maps from dimensions', () => {
    const colors = getDimensionColorMap(CCF_DIMENSIONS);
    const icons = getDimensionIconMap(CCF_DIMENSIONS);

    expect(colors.natural).toBe('#22c55e');
    expect(icons.financial).toBe('DollarSign');
  });

  it('clones a framework template into project-scoped rows', () => {
    let counter = 0;
    const cloned = cloneFrameworkToProject(getFrameworkTemplate('ccf'), 'project-123', () => {
      counter += 1;
      return `id-${counter}`;
    });

    expect(cloned.framework.project_id).toBe('project-123');
    expect(cloned.dimensions).toHaveLength(7);
    expect(cloned.dimensions.every((dimension) => dimension.framework_id === cloned.framework.id)).toBe(true);
  });
});
