import { updateWorkspaceManifest } from '@pnpm/workspace.manifest-writer'
import fs from 'node:fs'
import path from 'node:path'

// ## Background
//
// The published pnpm package contains a bundled dependencies directory in
// "dist/node_modules". To create this directory, pnpm install runs with
// --node-linker=hoisted.
//
// This run of pnpm install should reuse as many settings as possible from the
// workspace. For example, pnpm.overrides settings should be carried over since
// they might be overrides to fix CVE vulnerabilities.
//
// ## Purpose
//
// To support the above, this script copies over pnpm-workspace.yaml into the
// target directory with a few changes.

const TARGET_DIR = import.meta.dirname
const WORKSPACE_DIR = path.join(import.meta.dirname, '../..')

await fs.promises.cp(
  path.join(WORKSPACE_DIR, 'pnpm-workspace.yaml'),
  path.join(TARGET_DIR, 'pnpm-workspace.yaml'),
  { force: true })

await updateWorkspaceManifest(TARGET_DIR, {
  updatedFields: {
    packages: ['.'],

    // Patched dependencies are relative links that will need to be
    patchedDependencies: {},
  }
})
