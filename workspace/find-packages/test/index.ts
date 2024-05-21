import path from 'path'
import {
  findWorkspacePackagesNoCheck,
  arrayOfWorkspacePackagesToMap,
  findWorkspacePackages,
  type Project,
} from '@pnpm/workspace.find-packages'
import { logger } from '@pnpm/logger'

beforeEach(() => {
  jest.spyOn(logger, 'warn')
})

afterEach(() => {
  (logger.warn as jest.Mock).mockRestore()
})

// This is supported for compatibility with Yarn's implementation
// see https://github.com/pnpm/pnpm/issues/2648
test('arrayOfWorkspacePackagesToMap() treats private packages with no version as packages with 0.0.0 version', () => {
  const privateProject = {
    manifest: {
      name: 'private-pkg',
    },
  }
  expect(arrayOfWorkspacePackagesToMap([privateProject])).toStrictEqual({
    'private-pkg': {
      '0.0.0': privateProject,
    },
  })
})

test('findWorkspacePackagesNoCheck() skips engine checks', async () => {
  const pkgs = await findWorkspacePackagesNoCheck(path.join(__dirname, '__fixtures__/bad-engine'))
  expect(pkgs.length).toBe(1)
  expect(pkgs[0].manifest.name).toBe('pkg')
})

test('findWorkspacePackages() output warnings for non-root workspace project', async () => {
  const fixturePath = path.join(__dirname, '__fixtures__/warning-for-non-root-project')

  const pkgs = await findWorkspacePackages(fixturePath, {
    sharedWorkspaceLockfile: true,
  })
  expect(pkgs.length).toBe(3)
  expect(logger.warn).toHaveBeenCalledTimes(3)
  const fooPath = path.join(fixturePath, 'packages/foo')
  const barPath = path.join(fixturePath, 'packages/bar')
  expect(logger.warn).toHaveBeenNthCalledWith(1, { prefix: barPath, message: `The field "pnpm" was found in ${barPath}/package.json. This will not take effect. You should configure "pnpm" at the root of the workspace instead.` })
  expect(logger.warn).toHaveBeenNthCalledWith(2, { prefix: barPath, message: `The field "resolutions" was found in ${barPath}/package.json. This will not take effect. You should configure "resolutions" at the root of the workspace instead.` })
  expect(logger.warn).toHaveBeenNthCalledWith(3, { prefix: fooPath, message: `The field "pnpm" was found in ${fooPath}/package.json. This will not take effect. You should configure "pnpm" at the root of the workspace instead.` })
})

test('findWorkspacePackages() uses cached workspace manifest', async () => {
  const fixturePath = path.join(__dirname, '__fixtures__/simple')

  // Sanity check that the simple test fixture contains a foo and bar object.
  const pkgs = await findWorkspacePackages(fixturePath, {
    sharedWorkspaceLockfile: true,
  })
  expect(pkgs.sort(pkgManifestNameComparator)).toMatchObject([
    { manifest: { name: 'bar' } },
    { manifest: { name: 'foo' } },
  ])

  // Pass a different workspace manifest object that only contains foo to test
  // that it's used instead of the on-disk pnpm-workspace.yaml.
  const pkgs2 = await findWorkspacePackages(fixturePath, {
    sharedWorkspaceLockfile: true,
    workspaceManifest: { packages: ['packages/foo'] },
  })

  // Note that "toMatchObject" does not allow extra elements in the received
  // array per Jest docs.
  //
  // https://jestjs.io/docs/expect#tomatchobjectobject
  //
  // > You can also pass an array of objects, in which case the method will
  // > return true only if each object in the received array matches (in the
  // > toMatchObject sense described above) the corresponding object in the
  // > expected array. This is useful if you want to check that two arrays match
  // > in their number of elements, as opposed to arrayContaining, which allows
  // > for extra elements in the received array.
  expect(pkgs2).toMatchObject([
    { manifest: { name: 'foo' } },
  ])
})

function pkgManifestNameComparator (projectA: Project, projectB: Project): number {
  if (projectA.manifest.name == null && projectB.manifest.name == null) {
    return 0
  } else if (projectA.manifest.name == null) {
    return -1
  } else if (projectB.manifest.name == null) {
    return 1
  }

  return projectA.manifest.name.localeCompare(projectB.manifest.name)
}
