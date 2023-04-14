import { type ResolutionChange, type DedupeCheckIssue, type DedupeCheckIssues } from '@pnpm/types'
import archy from 'archy'
import chalk from 'chalk'

export function renderDedupeCheckIssues (dedupeCheckIssues: DedupeCheckIssues) {
  function toArchy (name: string, issue: DedupeCheckIssue): archy.Data {
    switch (issue.type) {
    case 'added':
      return { label: `${chalk.green('+')} ${name}` }
    case 'deleted':
      return { label: `${chalk.red('-')} ${name}` }
    case 'updated':
      return {
        label: name,
        nodes: Object.entries(issue.updates)
          .map(([alias, change]) => toArchyResolution(alias, change)),
      }
    }
  }

  function toArchyResolution (alias: string, change: ResolutionChange) {
    switch (change.type) {
    case 'added':
      return { label: `${chalk.green('+')} ${alias} ${chalk.dim(change.next)}` }
    case 'deleted':
      return { label: `${chalk.red('-')} ${alias} ${chalk.dim(change.prev)}` }
    case 'updated':
      return { label: `${alias} ${chalk.red(change.prev)} ${chalk.dim('→')} ${chalk.green(change.next)}` }
    }
  }

  const data: archy.Data = {
    label: 'importers',
    nodes: Object.entries(dedupeCheckIssues.importerIssuesByImporterId)
      .map(([importerId, issue]) => toArchy(importerId, issue)),
  }

  const packagesData: archy.Data = {
    label: 'packages',
    nodes: Object.entries(dedupeCheckIssues.packageIssuesByDepPath)
      .map(([id, issue]) => toArchy(id, issue)),
  }

  return archy(data) + '\n' + archy(packagesData)
}
