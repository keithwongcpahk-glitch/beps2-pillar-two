import { describe, expect, it } from 'vitest'
import { GLOBE_VERSION } from '../calc/globe'
import { RULESET_VERSION } from '../calc/pillarTwo'
import { INTEL_ITEMS } from '../intel/types'
import { CHANGELOG } from './changelog'
import { HOLIDAYS } from './jurisdictions/businessDays'
import { JURISDICTION_PACKS, PACK_CODES } from './jurisdictions'

describe('changelog data', () => {
  it('entries are unique, dated, sourced and newest first', () => {
    const ids = CHANGELOG.entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    const dates = CHANGELOG.entries.map((e) => e.date)
    expect([...dates].sort().reverse()).toEqual(dates)
    for (const e of CHANGELOG.entries) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(e.changes.length).toBeGreaterThan(0)
      expect(e.sources.length).toBeGreaterThan(0)
      e.sources.forEach((s) => expect(s.url).toMatch(/^https:\/\//))
      if (e.commit) expect(e.commit).toMatch(/^[0-9a-f]{7}$/)
    }
  })
  it('covers every current version: engines v0.1–v0.5, each pack version, the holiday data', () => {
    const versions = CHANGELOG.entries.map((e) => e.version)
    for (const v of ['oecd-hk-simplified-v0.1', 'oecd-asia-v0.2', 'oecd-asia-v0.3', 'oecd-asia-v0.4', GLOBE_VERSION, RULESET_VERSION, HOLIDAYS.version]) expect(versions).toContain(v)
    for (const c of PACK_CODES) {
      const p = JURISDICTION_PACKS[c]
      expect(versions.some((v) => v.includes(p.packId) && v.includes(p.packVersion))).toBe(true)
    }
  })
  it('linked intel items exist', () => {
    const known = new Set(INTEL_ITEMS.map((i) => i.id))
    for (const e of CHANGELOG.entries) e.intel.forEach((id) => expect(known.has(id), id).toBe(true))
  })
})
