export interface DedupeCheckIssues {
  readonly importerIssuesByImporterId: Record<string, DedupeCheckIssue>
  readonly packageIssuesByDepPath: Record<string, DedupeCheckIssue>
}

export type DedupeCheckIssue =
  DedupeCheckIssueAdded |
  DedupeCheckIssueDeleted |
  DedupeCheckIssueUpdated

export type ResolutionChangesByAlias = Record<string, ResolutionChange>

export interface DedupeCheckIssueAdded {
  readonly type: 'added'
}

export interface DedupeCheckIssueDeleted {
  readonly type: 'deleted'
}

export interface DedupeCheckIssueUpdated {
  readonly type: 'updated'
  readonly updates: ResolutionChangesByAlias
}

export type ResolutionChange = ResolutionAdded | ResolutionDeleted | ResolutionUpdated

export interface ResolutionAdded {
  readonly type: 'added'
  readonly next: string
}

export interface ResolutionDeleted {
  readonly type: 'deleted'
  readonly prev: string
}

export interface ResolutionUpdated {
  readonly type: 'updated'
  readonly prev: string
  readonly next: string
}
