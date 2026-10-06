/** Ruleset / pack / calendar version history (src/rules/changelog.v1.json). */
import changelogJson from './changelog.v1.json'

export type ChangeKind = 'engine' | 'pack' | 'calendar'

export interface ChangeEntry {
  id: string
  kind: ChangeKind
  version: string
  date: string
  commit?: string
  title: string
  changes: string[]
  sources: { label: string; url: string }[]
  /** Ids of intel items (src/intel/updates.json) that triggered or relate to the change. */
  intel: string[]
}

export interface Changelog {
  version: string
  note: string
  entries: ChangeEntry[]
}

export const CHANGELOG = changelogJson as Changelog
export const REPO_COMMIT_URL = 'https://github.com/keithwongcpahk-glitch/beps2-pillar-two/commit/'
