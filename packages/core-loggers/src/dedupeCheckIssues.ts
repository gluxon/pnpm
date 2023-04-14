import {
  type LogBase,
  type Logger,
  logger,
} from '@pnpm/logger'
import { type DedupeCheckIssues } from '@pnpm/types'

export const dedupeCheckIssuesLogger = logger('dedupe-check-issues') as Logger<DedupeCheckIssuesMessage>

export interface DedupeCheckIssuesMessage {
  readonly dedupeCheckIssues: DedupeCheckIssues
}

export type DedupeCheckIssuesLog = { name: 'pnpm:dedupe-check-issues' } & LogBase & DedupeCheckIssuesMessage

// This file may not be required.
