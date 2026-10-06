/**
 * Named scenarios (Phase 4.1). Pure list operations; the UI persists the list in localStorage.
 * Each scenario stores the full group input, so results are recomputed with the current engine.
 */
import type { GroupInputV3 } from './globe'
import { parseStoredGroup } from './sampleGroup'

export interface SavedScenario {
  id: string
  name: string
  /** ISO timestamp (UTC) of the last save. */
  savedAt: string
  input: GroupInputV3
}

export const SCENARIOS_KEY = 'p2-scenarios-v1'
export const SCENARIOS_FILE_KIND = 'pillar-two-asia/scenarios'
const MAX_NAME = 80

export function cleanName(name: string): string {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
  return n || 'Untitled scenario'
}

/** Returns `base`, or `base (2)`, `base (3)`… so names stay unique in the list. */
export function uniqueName(list: SavedScenario[], base: string, exceptId?: string): string {
  const taken = new Set(list.filter((s) => s.id !== exceptId).map((s) => s.name.toLowerCase()))
  const b = cleanName(base)
  if (!taken.has(b.toLowerCase())) return b
  for (let i = 2; i < 1000; i++) {
    const n = `${b} (${i})`
    if (!taken.has(n.toLowerCase())) return n
  }
  return `${b} (${Date.now()})`
}

export function addScenario(list: SavedScenario[], name: string, input: GroupInputV3, now: string, id: string): SavedScenario[] {
  return [...list, { id, name: uniqueName(list, name), savedAt: now, input: structuredCloneSafe(input) }]
}

export function updateScenarioInput(list: SavedScenario[], id: string, input: GroupInputV3, now: string): SavedScenario[] {
  return list.map((s) => (s.id === id ? { ...s, input: structuredCloneSafe(input), savedAt: now } : s))
}

export function renameScenario(list: SavedScenario[], id: string, name: string): SavedScenario[] {
  return list.map((s) => (s.id === id ? { ...s, name: uniqueName(list, name, id) } : s))
}

export function duplicateScenario(list: SavedScenario[], id: string, now: string, newId: string): SavedScenario[] {
  const i = list.findIndex((s) => s.id === id)
  if (i < 0) return list
  const src = list[i]
  const copy: SavedScenario = { id: newId, name: uniqueName(list, `${src.name} (copy)`), savedAt: now, input: structuredCloneSafe(src.input) }
  return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]
}

export function deleteScenario(list: SavedScenario[], id: string): SavedScenario[] {
  return list.filter((s) => s.id !== id)
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function parseOne(x: unknown): SavedScenario | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Partial<SavedScenario>
  const input = parseStoredGroup(JSON.stringify(o.input ?? null))
  if (!input || typeof o.id !== 'string' || !o.id) return null
  return { id: o.id, name: cleanName(typeof o.name === 'string' ? o.name : ''), savedAt: typeof o.savedAt === 'string' ? o.savedAt : '', input }
}

/** Defensive parse of the stored list; drops unusable entries and duplicate ids. */
export function parseScenarios(raw: string | null | undefined): SavedScenario[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    const arr = Array.isArray(v) ? v : v && typeof v === 'object' && Array.isArray((v as { scenarios?: unknown }).scenarios) ? (v as { scenarios: unknown[] }).scenarios : []
    const seen = new Set<string>()
    const out: SavedScenario[] = []
    for (const x of arr) {
      const s = parseOne(x)
      if (s && !seen.has(s.id)) {
        seen.add(s.id)
        out.push(s)
      }
    }
    return out
  } catch {
    return []
  }
}

/** One-off migration of the Phase 4 (partial) single "scenario A" slot. */
export function migrateLegacyScenarioA(legacyRaw: string | null | undefined, now: string): SavedScenario[] {
  const g = parseStoredGroup(legacyRaw)
  return g ? [{ id: 'legacy-a', name: cleanName(`Scenario A: ${g.groupName}`), savedAt: now, input: g }] : []
}

export function scenariosToJson(list: SavedScenario[], exportedAt: string): string {
  return JSON.stringify({ kind: SCENARIOS_FILE_KIND, version: 1, exportedAt, scenarios: list }, null, 2)
}

/**
 * Parses an import file: a scenarios export ({kind, scenarios}) or a single group inputs JSON.
 * Imported scenarios get fresh ids and unique names relative to `existing`.
 */
export function importScenarios(existing: SavedScenario[], raw: string, now: string, newId: (i: number) => string): { list: SavedScenario[]; added: number } {
  let incoming = parseScenarios(raw)
  if (!incoming.length) {
    const g = parseStoredGroup(raw)
    if (g) incoming = [{ id: 'import', name: g.groupName, savedAt: now, input: g }]
  }
  let list = existing
  incoming.forEach((s, i) => {
    list = [...list, { ...s, id: newId(i), name: uniqueName(list, s.name), savedAt: s.savedAt || now }]
  })
  return { list, added: incoming.length }
}
