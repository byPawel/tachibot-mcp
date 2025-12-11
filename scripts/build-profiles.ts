/**
 * Build Profiles Script
 * Converts TypeScript profile definitions to JSON files
 * Run during npm run build
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import profile definitions
import { minimalProfile } from '../src/profiles/minimal.js';
import { researchPowerProfile } from '../src/profiles/research_power.js';
import { codeFocusProfile } from '../src/profiles/code_focus.js';
import { balancedProfile } from '../src/profiles/balanced.js';
import { fullProfile } from '../src/profiles/full.js';
import { heavyCodingProfile } from '../src/profiles/heavy_coding.js';

const profiles = {
  minimal: minimalProfile,
  research_power: researchPowerProfile,
  code_focus: codeFocusProfile,
  balanced: balancedProfile,
  full: fullProfile,
  heavy_coding: heavyCodingProfile,
};

// Output directory - write to root profiles/ (not dist/profiles/)
const outputDir = join(__dirname, '../..', 'profiles');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

console.log('🔨 Building profile JSON files...\n');

// Convert each profile to JSON
for (const [name, profile] of Object.entries(profiles)) {
  const outputPath = join(outputDir, `${name}.json`);

  // Count enabled tools
  const enabledCount = Object.values(profile.tools).filter(Boolean).length;

  // Update description with actual count (replace any existing count)
  const updatedProfile = {
    ...profile,
    description: profile.description.replace(/\d+ tools\)/, `${enabledCount} tools)`)
  };

  const jsonContent = JSON.stringify(updatedProfile, null, 2);
  writeFileSync(outputPath, jsonContent, 'utf-8');

  console.log(`✅ ${name}.json (${enabledCount} tools)`);
}

console.log(`\n✨ Built ${Object.keys(profiles).length} profile files in ${outputDir}`);
