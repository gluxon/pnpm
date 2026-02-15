import type { MutateModulesOptions, MutatedProject, ProjectOptions } from '@pnpm/core'
import { prepareEmpty } from '@pnpm/prepare'
import type { PackageMeta } from '@pnpm/registry.types'
import type { ProjectRootDir, ProjectId, ProjectManifest } from '@pnpm/types'
import fs from 'fs'
import path from 'path'
import nock from 'nock'
import { testDefaults } from '../utils/index.js'

const { mutateModules } = await import('@pnpm/core')

function createProjectOptions (projects: Record<ProjectId, ProjectManifest>): ProjectOptions[] {
  const allProjects: ProjectOptions[] = Object.entries(projects)
    .map(([id, manifest]) => ({
      buildIndex: 0,
      manifest,
      rootDir: path.resolve(id) as ProjectRootDir,
    }))
  return allProjects
}

function installProjects (projects: Record<ProjectId, ProjectManifest>): MutatedProject[] {
  return Object.entries(projects)
    .map(([id, manifest]) => ({
      mutation: 'install',
      id,
      manifest,
      rootDir: path.resolve(id) as ProjectRootDir,
    }))
}

afterEach(() => {
  nock.cleanAll()
  nock.disableNetConnect()
})

test('prerelease weights', async () => {
  const rootProject = prepareEmpty()
  const lockfileDir = rootProject.dir()

  const name = '@pnpm.e2e/prerelease'

  const projects: Record<ProjectId, ProjectManifest> = {
    ['a' as ProjectId]: {
      name: 'a',
      dependencies: {
        [name]: '^1.1.0-beta',
      },
    },
    ['b' as ProjectId]: {
      name: 'b',
      dependencies: {
        [name]: '^1.2.0-beta',
      },
    },
    ['c' as ProjectId]: {
      name: 'c',
    },
  }
  const allProjects = createProjectOptions(projects)
  const options = {
    ...testDefaults(
      { allProjects },
      { retry: { retries: 0 } }
    ),
    lockfileDir,
    lockfileOnly: true,
    resolutionMode: 'highest',
  } satisfies MutateModulesOptions

  const meta: PackageMeta = {
    name,
    versions: {
      '1.1.0-beta': {
        name,
        version: '1.1.0-beta',
        // Generated locally through: echo '1.1.0-beta' | sha1sum
        dist: { shasum: '7957736c00bc1e5a875e5e4f8f48d8f5a3830866', tarball: `${options.registries.default}/${name}-1.1.0-beta.tgz` },
      },
      '1.2.0-beta': {
        name,
        version: '1.2.0-beta',
        dist: { shasum: '50c0586b05b59205f39610d63cc38ea04954182c', tarball: `${options.registries.default}/${name}-1.2.0-beta.tgz` },
      },
    },
    'dist-tags': {
      latest: '1.2.0-beta',
    },
  }

  nock(options.registries.default)
    // cspell:disable-next-line
    .get('/@pnpm.e2e%2Fprerelease')
    .reply(200, meta)

  await mutateModules(installProjects(projects), options)

  {
    const lockfile = rootProject.readLockfile()
    expect(lockfile.importers['a' as ProjectId].dependencies?.[name]).toEqual({
      specifier: '^1.1.0-beta',
      version: '1.1.0-beta',
    })
    expect(lockfile.importers['b' as ProjectId].dependencies?.[name]).toEqual({
      specifier: '^1.2.0-beta',
      version: '1.2.0-beta',
    })
  }

  // Simulate publishing a new 1.2.0 version.
  meta.versions['1.2.0'] = {
    name,
    version: '1.2.0',
    dist: { shasum: 'f95c23882c82328c872ac94af630c49ae57f37bb', tarball: `${options.registries.default}/${name}-1.2.0.tgz` },
  }
  meta['dist-tags'].latest = '1.2.0'

  nock(options.registries.default)
    // cspell:disable-next-line
    .get('/@pnpm.e2e%2Fprerelease')
    .reply(200, meta)

  fs.rmSync(options.cacheDir, { recursive: true })
  options.storeController.clearResolutionCache()

  projects['c' as ProjectId].dependencies = { [name]: '^1.2.0-beta' }
  await mutateModules(installProjects(projects), options)

  const lockfile = rootProject.readLockfile()
  expect(lockfile.importers['c' as ProjectId].dependencies?.[name]).toEqual({
    specifier: '^1.2.0-beta',
    version: '1.2.0-beta',
  })

  expect(nock.isDone()).toBeTruthy()
}, 60_000)
