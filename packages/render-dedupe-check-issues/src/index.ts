import { type ResolutionChange, type DedupeCheckIssues, type ResolutionChangesByAlias, type SnapshotsChanges } from '@pnpm/types'
import archy from 'archy'
import chalk from 'chalk'

export function renderDedupeCheckIssues (dedupeCheckIssues: DedupeCheckIssues) {
  const importersReport = report(dedupeCheckIssues.importerIssuesByImporterId)
  const packagesReport = report(dedupeCheckIssues.packageIssuesByDepPath)

  const lines = []
  if (importersReport != null) {
    lines.push(chalk.blueBright.underline('Importers'))
    lines.push(importersReport)
    lines.push('')
  }
  if (packagesReport != null) {
    lines.push(chalk.blueBright.underline('Packages'))
    lines.push(packagesReport)
    lines.push('')
  }

  return lines.join('\n')
}

function report (snapshotChanges: SnapshotsChanges): string | null {
  if (countChangedSnapshots(snapshotChanges) === 0) {
    return null
  }

  return [
    ...Object.entries(snapshotChanges.updated).map(([alias, updates]) => archy(toArchy(alias, updates))),
    ...snapshotChanges.added.map((id) => `${chalk.green('+')} ${id}`),
    ...snapshotChanges.removed.map((id) => `${chalk.red('-')} ${id}`),
  ].join('\n')
}

function toArchy (name: string, issue: ResolutionChangesByAlias): archy.Data {
  return {
    label: name,
    nodes: Object.entries(issue).map(([alias, change]) => toArchyResolution(alias, change)),
  }
}

function toArchyResolution (alias: string, change: ResolutionChange): archy.Data {
  switch (change.type) {
  case 'added':
    return { label: `${chalk.green('+')} ${alias} ${chalk.dim(change.next)}` }
  case 'removed':
    return { label: `${chalk.red('-')} ${alias} ${chalk.dim(change.prev)}` }
  case 'updated':
    return { label: `${alias} ${chalk.red(change.prev)} ${chalk.dim('→')} ${chalk.green(change.next)}` }
  }
}

function countChangedSnapshots (snapshotChanges: SnapshotsChanges): number {
  return snapshotChanges.added.length + snapshotChanges.removed.length + Object.keys(snapshotChanges.updated).length
}
