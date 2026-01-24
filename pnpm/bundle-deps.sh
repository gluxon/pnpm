#!/usr/bin/env sh

# pnpm includes some bundled dependencies in its "dist/node_modules" directory.
# This script runs during publishing and populates that directory.

set -o errexit

# Generate a pnpm-workspace.yaml file in the temporary directory that bundled
# deps will be installed in. This allows installed node-modules to be as similar
# as possible to the

cd bundled-deps

node ./generate-workspace-manifest.mts
rm -rf node_modules
pnpm install --no-lockfile --node-linker=hoisted

# Remove some files that aren't necessary in the final published dist.
../node_modules/.bin/nm-prune --force
rm -rf node_modules/.pnpm \
  node_modules/.modules.yaml \
  node_modules/.pnpm-workspace-state-v1.json

cd ..
rm -rf dist/node_modules
mv bundled-deps/node_modules dist/node_modules
