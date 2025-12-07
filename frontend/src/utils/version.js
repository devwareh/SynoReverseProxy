/**
 * Application Version
 * 
 * Update this version number when releasing a new version.
 * Follow semantic versioning: MAJOR.MINOR.PATCH
 * 
 * - MAJOR: Breaking changes
 * - MINOR: New features (backward compatible)
 * - PATCH: Bug fixes (backward compatible)
 */
export const APP_VERSION = "1.0.0";

/**
 * Version metadata
 */
export const VERSION_INFO = {
  version: APP_VERSION,
  buildDate: process.env.REACT_APP_BUILD_DATE || new Date().toISOString().split('T')[0],
};

