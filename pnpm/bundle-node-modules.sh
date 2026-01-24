#!/usr/bin/env sh

cd bundled-dependencies

pnpm --no-lockfile --node-linker=hoisted --ignore-workspace install

../node_modules/.bin/nm-prune --force

rm -rf \
    node_modules/.pnpm \
    node_modules/.modules.yaml \
    node_modules/.pnpm-workspace-state-v1.json

cd ..
mv bundled-dependencies/node_modules dist
