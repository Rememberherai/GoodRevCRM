export const LAST_PROJECT_SLUG_COOKIE = 'goodrev-last-project-slug';
export const LAST_PROJECT_SLUG_STORAGE_KEY = 'goodrev:last-project-slug';

export function getProjectHref(slug: string | null | undefined) {
  return slug ? `/projects/${slug}` : '/projects';
}
