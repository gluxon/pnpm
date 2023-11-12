import { getConfig } from '@pnpm/config'
import { WANTED_LOCKFILE } from '@pnpm/constants'
import { createPeersDirSuffix } from '@pnpm/dependency-path'
import { type Lockfile } from '@pnpm/lockfile-types'
import { type ProjectId, type ProjectManifest } from '@pnpm/types'
import { filterPackagesFromDir } from '@pnpm/workspace.filter-packages-from-dir'
import { preparePackages } from '@pnpm/prepare'
import { install } from '@pnpm/plugin-commands-installation'
import path from 'path'
import readYamlFile from 'read-yaml-file'
import writeYamlFile from 'write-yaml-file'
import { DEFAULT_OPTS } from './utils'

/**
 * A utility to make writing catalog tests easier by reducing boilerplate.
 */
class CatalogTestsController {
  private readonly workspaceDir: string

  constructor (readonly pkgs: Array<{ location: string, package: ProjectManifest }>) {
    preparePackages(pkgs)
    this.workspaceDir = process.cwd()
  }

  async writeWorkspaceYml (data: unknown) {
    await writeYamlFile(path.join(this.workspaceDir, 'pnpm-workspace.yaml'), data)
  }

  async install (opts?: { frozenLockfile?: boolean, filter?: readonly string[] }) {
    const { allProjects, selectedProjectsGraph } = await filterPackagesFromDir(this.workspaceDir, opts?.filter?.map(parentDir => ({ parentDir })) ?? [])

    // Most tests directly supply DEFAULT_OPTS to command handlers and don't
    // call getConfig. This test is a bit more special since the
    // workspaceManifest is read through getConfig().
    const { config } = await getConfig({
      cliOptions: {
        ...DEFAULT_OPTS.cliOptions,
        registry: DEFAULT_OPTS.registry,
      },
      packageManager: { name: 'pnpm', version: 'test' },
      workspaceDir: this.workspaceDir,
    })

    await install.handler({
      ...DEFAULT_OPTS,
      ...config,
      allProjects,
      selectedProjectsGraph,
      rawLocalConfig: {
        ...DEFAULT_OPTS.rawLocalConfig,
        ...config.rawLocalConfig,
        // Many tests check if the pnpm-lock.yaml is updated after a
        // package.json or pnpm-workspace.yaml change. Setting frozen-lockfile
        // to false is necessary for these tests to pass on CI since this
        // defaults to true on CI.
        'frozen-lockfile': opts?.frozenLockfile ?? true,
      },
    })
  }

  async lockfile (): Promise<Lockfile> {
    return readYamlFile(path.join(this.workspaceDir, WANTED_LOCKFILE))
  }

  async updateProjectManifest (location: string, manifest: ProjectManifest): Promise<void> {
    const { selectedProjectsGraph } = await filterPackagesFromDir(this.workspaceDir, [{ parentDir: location }])
    await selectedProjectsGraph[path.join(this.workspaceDir, location)].package.writeProjectManifest(manifest)
  }
}

test('installing with "catalog:" should work', async () => {
  const ctrl = new CatalogTestsController([
    {
      location: 'packages/project1',
      package: {
        dependencies: {
          'is-positive': 'catalog:',
        },
      },
    },
    // Empty second project to create a multi-package workspace.
    {
      location: 'packages/project2',
      package: {},
    },
  ])

  await ctrl.writeWorkspaceYml({
    packages: ['packages/*'],
    catalog: { 'is-positive': '1.0.0' },
  })
  await ctrl.install()
  const lockfile = await ctrl.lockfile()

  expect(lockfile.importers['packages/project1' as ProjectId]).toEqual({
    dependencies: {
      'is-positive': {
        specifier: 'catalog:',
        version: '1.0.0',
      },
    },
  })
})

test('importer to importer dependency with "catalog:" should work', async () => {
  const ctrl = new CatalogTestsController([
    {
      location: 'packages/project1',
      package: {
        name: 'project1',
        dependencies: {
          project2: 'workspace:*',
        },
      },
    },
    {
      location: 'packages/project2',
      package: {
        name: 'project2',
        dependencies: {
          'is-positive': 'catalog:',
        },
      },
    },
  ])

  await ctrl.writeWorkspaceYml({
    packages: ['packages/*'],
    catalog: { 'is-positive': '1.0.0' },
  })

  await ctrl.install()
  const lockfile = await ctrl.lockfile()

  expect(lockfile.importers['packages/project2' as ProjectId]).toEqual({
    dependencies: {
      'is-positive': {
        specifier: 'catalog:',
        version: '1.0.0',
      },
    },
  })
})

test('importer with different peers uses correct peer', async () => {
  const ctrl = new CatalogTestsController([
    {
      location: 'packages/project1',
      package: {
        dependencies: {
          '@pnpm.e2e/has-foo100-peer': 'catalog:',
          // Define a peer with an exact version to ensure the dep above uses
          // this peer.
          '@pnpm.e2e/foo': '100.0.0',
        },
      },
    },
    {
      location: 'packages/project2',
      package: {
        dependencies: {
          '@pnpm.e2e/has-foo100-peer': 'catalog:',
          // Note that this peer is intentionally different than the one above
          // for project 1. (100.1.0 instead of 100.0.0).
          //
          // We want to ensure project2 resolves to the same catalog version for
          // @pnpm.e2e/has-foo100-peer, but uses a different peers suffix.
          //
          // Catalogs allow versions to be reused, but this test ensures we
          // don't reuse versions too aggressively.
          '@pnpm.e2e/foo': '100.1.0',
        },
      },
    },
  ])

  await ctrl.writeWorkspaceYml({
    packages: ['packages/*'],
    catalog: {
      '@pnpm.e2e/has-foo100-peer': '^1.0.0',
    },
  })

  await ctrl.install()
  const lockfile = await ctrl.lockfile()

  expect(lockfile.importers['packages/project1' as ProjectId]?.dependencies?.['@pnpm.e2e/has-foo100-peer']).toEqual({
    specifier: 'catalog:',
    version: `1.0.0${createPeersDirSuffix([{ name: '@pnpm.e2e/foo', version: '100.0.0' }])}`,
  })
  expect(lockfile.importers['packages/project2' as ProjectId]?.dependencies?.['@pnpm.e2e/has-foo100-peer']).toEqual({
    specifier: 'catalog:',
    //              This version is intentionally different from the one above    ꜜ
    version: `1.0.0${createPeersDirSuffix([{ name: '@pnpm.e2e/foo', version: '100.1.0' }])}`,
  })
})

test('lockfile contains catalog snapshots', async () => {
  const ctrl = new CatalogTestsController([
    {
      location: 'packages/project1',
      package: {
        dependencies: {
          'is-positive': 'catalog:',
        },
      },
    },
    {
      location: 'packages/project2',
      package: {
        dependencies: {
          'is-negative': 'catalog:',
        },
      },
    },
  ])

  await ctrl.writeWorkspaceYml({
    packages: ['packages/*'],
    catalog: {
      'is-positive': '^1.0.0',
      'is-negative': '^1.0.0',
    },
  })

  await ctrl.install()
  const lockfile = await ctrl.lockfile()

  expect(lockfile.catalogs).toStrictEqual({
    default: {
      'is-positive': { specifier: '^1.0.0', version: '1.0.0' },
      'is-negative': { specifier: '^1.0.0', version: '1.0.0' },
    },
  })
})

test('lockfile is updated if catalog config changes', async () => {
  const ctrl = new CatalogTestsController([
    {
      location: 'packages/project1',
      package: {
        dependencies: {
          'is-positive': 'catalog:',
        },
      },
    },
  ])

  await ctrl.writeWorkspaceYml({
    packages: ['packages/*'],
    catalog: { 'is-positive': '=1.0.0' },
  })
  await ctrl.install()

  expect((await ctrl.lockfile()).importers['packages/project1' as ProjectId]).toEqual({
    dependencies: {
      'is-positive': {
        specifier: 'catalog:',
        version: '1.0.0',
      },
    },
  })

  await ctrl.writeWorkspaceYml({
    packages: ['packages/*'],
    catalog: {
      'is-positive': '=3.1.0',
    },
  })
  await ctrl.install()

  expect((await ctrl.lockfile()).importers['packages/project1' as ProjectId]).toEqual({
    dependencies: {
      'is-positive': {
        specifier: 'catalog:',
        version: '3.1.0',
      },
    },
  })
})

test('lockfile catalog snapshots retain existing entries on --filter', async () => {
  const ctrl = new CatalogTestsController([
    {
      location: 'packages/project1',
      package: {
        dependencies: {
          'is-negative': 'catalog:',
        },
      },
    },
    {
      location: 'packages/project2',
      package: {
        dependencies: {
          'is-positive': 'catalog:',
        },
      },
    },
  ])

  await ctrl.writeWorkspaceYml({
    packages: ['packages/*'],
    catalog: {
      'is-positive': '^1.0.0',
      'is-negative': '^1.0.0',
    },
  })

  await ctrl.install()

  expect((await ctrl.lockfile()).catalogs).toStrictEqual({
    default: {
      'is-negative': { specifier: '^1.0.0', version: '1.0.0' },
      'is-positive': { specifier: '^1.0.0', version: '1.0.0' },
    },
  })

  // Update catalog definitions so pnpm triggers a rerun.
  await ctrl.writeWorkspaceYml({
    packages: ['packages/*'],
    catalog: {
      'is-positive': '=3.1.0',
      'is-negative': '^1.0.0',
    },
  })
  await ctrl.install({ filter: ['packages/project2'] })

  expect((await ctrl.lockfile()).catalogs).toStrictEqual({
    default: {
      // The is-negative snapshot should be carried from the previous install,
      // despite the current filtered install not using it.
      'is-negative': { specifier: '^1.0.0', version: '1.0.0' },

      'is-positive': { specifier: '=3.1.0', version: '3.1.0' },
    },
  })
})

test('lockfile catalog snapshots should keep unused entries', async () => {
  const ctrl = new CatalogTestsController([
    {
      location: 'packages/project1',
      package: {
        dependencies: {
          'is-positive': 'catalog:',
        },
      },
    },
  ])

  await writeYamlFile('pnpm-workspace.yaml', {
    packages: ['packages/*'],
    catalog: {
      'is-positive': '=1.0.0',
    },
  })

  {
    await ctrl.install()
    const lockfile = await ctrl.lockfile()
    expect(lockfile.importers['packages/project1' as ProjectId]?.dependencies?.['is-positive']).toEqual({
      specifier: 'catalog:',
      version: '1.0.0',
    })
    expect(lockfile.catalogs?.default).toStrictEqual({
      'is-positive': { specifier: '=1.0.0', version: '1.0.0' },
    })
  }

  await ctrl.updateProjectManifest('packages/project1', { dependencies: { 'is-positive': '=1.0.0' } })
  await ctrl.install()

  {
    const lockfile = await ctrl.lockfile()
    expect(lockfile.importers['packages/project1' as ProjectId]).toEqual({
      dependencies: {
        'is-positive': {
          specifier: '=1.0.0',
          version: '1.0.0',
        },
      },
    })
    expect(lockfile.catalogs?.default).toStrictEqual({
      'is-positive': { specifier: '=1.0.0', version: '1.0.0' },
    })
  }
})
