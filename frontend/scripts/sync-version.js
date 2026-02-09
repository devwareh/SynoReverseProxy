#!/usr/bin/env node
/**
 * Sync version from root VERSION file to frontend source
 * Run this before building the frontend
 */

const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '..', '..', 'VERSION');
const VERSION_JS = path.join(__dirname, '..', 'src', 'utils', 'version.js');

try {
    // Read version from VERSION file
    const version = fs.readFileSync(VERSION_FILE, 'utf8').trim();

    // Generate version.js content
    const content = `/**
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
export const APP_VERSION = "${version}";

/**
 * Version metadata
 */
export const VERSION_INFO = {
  version: APP_VERSION,
  buildDate: process.env.REACT_APP_BUILD_DATE || new Date().toISOString().split('T')[0],
};
`;

    // Write to version.js
    fs.writeFileSync(VERSION_JS, content, 'utf8');

    console.log(`✓ Synced version ${version} to frontend/src/utils/version.js`);
} catch (error) {
    console.error('✗ Failed to sync version:', error.message);
    process.exit(1);
}
