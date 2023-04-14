import { PnpmError } from '@pnpm/error'
import { type ResolvedDependencies, type Lockfile } from '@pnpm/lockfile-types'
import {
  DEPENDENCIES_FIELDS,
  type ResolutionChangesByAlias,
  type DedupeCheckIssue,
  type DedupeCheckIssues,
} from '@pnpm/types'

export function dedupeDiffCheck (prev: Lockfile, next: Lockfile): void {
  function getImporterIssuesByImporterId () {
    const importerIssuesByImporterId: Record<string, DedupeCheckIssue> = {}

    for (const [importerId, prevSnapshot] of Object.entries(prev.importers ?? {})) {
      const nextSnapshot = next.importers[importerId]

      if (nextSnapshot == null) {
        importerIssuesByImporterId[importerId] = { type: 'deleted' }
        continue
      }

      const updates = DEPENDENCIES_FIELDS.reduce((acc: ResolutionChangesByAlias, dependencyField) => ({
        ...acc,
        ...getResolutionUpdates(prevSnapshot[dependencyField] ?? {}, nextSnapshot[dependencyField] ?? {}),
      }), {})

      if (Object.keys(updates).length > 0) {
        importerIssuesByImporterId[importerId] = { type: 'updated', updates }
      }
    }

    const newImporterIds = Object.keys(next.importers ?? {})
      .filter(importerId => prev.importers[importerId] == null)
    for (const added of newImporterIds) {
      importerIssuesByImporterId[added] = { type: 'added' }
    }

    return importerIssuesByImporterId
  }

  function getPackageIssuesByDepPath () {
    const packageIssuesByDepPath: Record<string, DedupeCheckIssue> = {}

    for (const [depPath, prevSnapshot] of Object.entries(prev.packages ?? {})) {
      const nextSnapshot = next.packages?.[depPath]

      if (nextSnapshot == null) {
        packageIssuesByDepPath[depPath] = { type: 'deleted' }
        continue
      }

      const updates = (['dependencies', 'optionalDependencies'] as const)
        .reduce((acc: ResolutionChangesByAlias, dependencyField) => ({
          ...acc,
          ...getResolutionUpdates(prevSnapshot[dependencyField] ?? {}, nextSnapshot?.[dependencyField] ?? {}),
        }), {})

      if (Object.keys(updates).length > 0) {
        packageIssuesByDepPath[depPath] = { type: 'updated', updates }
      }
    }

    const newDepPaths = Object.keys(next.packages ?? {})
      .filter(depPath => prev.packages?.[depPath] == null)
    for (const added of newDepPaths) {
      packageIssuesByDepPath[added] = { type: 'added' }
    }

    return packageIssuesByDepPath
  }

  function getResolutionUpdates (prev: ResolvedDependencies, next: ResolvedDependencies): ResolutionChangesByAlias {
    const updates: ResolutionChangesByAlias = {}

    for (const [alias, prevResolution] of Object.entries(prev ?? {})) {
      const nextResolution = next?.[alias]

      if (prevResolution === nextResolution) {
        continue
      }

      updates[alias] = nextResolution == null
        ? { type: 'deleted', prev: prevResolution }
        : { type: 'updated', prev: prevResolution, next: nextResolution }
    }

    const newAliases = Object.entries(next ?? {})
      .filter(([alias]) => prev?.[alias] == null)
    for (const [alias, nextResolution] of newAliases) {
      updates[alias] = { type: 'added', next: nextResolution }
    }

    return updates
  }

  const issues: DedupeCheckIssues = {
    importerIssuesByImporterId: getImporterIssuesByImporterId(),
    packageIssuesByDepPath: getPackageIssuesByDepPath(),
  }

  const changesCount =
    Object.keys(issues.importerIssuesByImporterId).length +
    Object.keys(issues.packageIssuesByDepPath).length

  if (changesCount > 0) {
    throw new DedupeCheckIssuesError(issues)
  }
}

export class DedupeCheckIssuesError extends PnpmError {
  constructor (public dedupeCheckIssues: DedupeCheckIssues) {
    super('DEDUPE_CHECK_ISSUES', 'Dedupe --check found changes to the lockfile')
  }
}
