/**
 * Application Version
 * 
 * This file is auto-generated from the VERSION file at project root.
 * DO NOT EDIT MANUALLY - Run 'npm run sync-version' to update.
 * 
 * Follow semantic versioning: MAJOR.MINOR.PATCH
 * 
 * - MAJOR: Breaking changes
 * - MINOR: New features (backward compatible)
 * - PATCH: Bug fixes (backward compatible)
 */
export const APP_VERSION = "1.3.0";

/**
 * Version metadata
 */
export const VERSION_INFO = {
  version: APP_VERSION,
  buildDate: process.env.REACT_APP_BUILD_DATE || new Date().toISOString().split('T')[0],
};
