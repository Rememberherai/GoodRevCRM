export { detectDuplicates, detectPersonDuplicates, detectOrganizationDuplicates } from './detector';
export {
  normalizeEmail,
  normalizePhone,
  normalizeOrgName,
  extractLinkedInId,
  extractDomainFromEmail,
  extractDomainFromUrl,
  jaroWinkler,
  scorePersonMatch,
  scoreOrganizationMatch,
} from './detector';
export { performMerge } from './merge';
export {
  FREE_EMAIL_PROVIDERS,
  ORG_NAME_SUFFIXES,
  PERSON_WEIGHTS,
  ORG_WEIGHTS,
  DEFAULT_MIN_THRESHOLD,
  DEFAULT_AUTO_MERGE_THRESHOLD,
  FUZZY_NAME_THRESHOLD,
} from './constants';
