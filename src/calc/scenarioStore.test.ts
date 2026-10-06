import { describe, expect, it } from 'vitest'
import { projectGlobe } from './globe'
import { SAMPLE_GROUP } from './sampleGroup'
import { compareProjections } from './scenarios'
import {
  addScenario, cleanName, deleteScenario, duplicateScenario, importScenarios, migrateLegacyScenarioA, parseScenarios, renameScenario, scenariosToJson, updateScenarioInput,
} from './scenarioStore'

const T = '2026-10-06T03:00:00.000Z'
const base = addScenario([], 'Base FY2026', SAMPLE_GROUP, T, 's1')

describe('named scenarios', () => {
  it('save, rename (unique names), duplicate (inserted after source), delete', () => {
    let l = addScenario(base, 'Base FY2026', { ...SAMPLE_GROUP, fiscalYearStart: '2026-04-01' }, T, 's2')
    expect(l.map((s) => s.name)).toEqual(['Base FY2026', 'Base FY2026 (2)'])
    l = renameScenario(l, 's2', '  JP April start  ')
    expect(l[1].name).toBe('JP April start')
    expect(renameScenario(l, 's2', 'base fy2026')[1].name).toBe('base fy2026 (2)')
    l = duplicateScenario(l, 's1', T, 's3')
    expect(l.map((s) => s.id)).toEqual(['s1', 's3', 's2'])
    expect(l[1].name).toBe('Base FY2026 (copy)')
    expect(l[1].input).toEqual(l[0].input)
    expect(l[1].input).not.toBe(l[0].input)
    l = deleteScenario(l, 's1')
    expect(l.map((s) => s.id)).toEqual(['s3', 's2'])
    expect(cleanName('   ')).toBe('Untitled scenario')
  })

  it('stored list round-trips; corrupt entries and duplicate ids are dropped', () => {
    const raw = JSON.stringify([...base, { id: 's1', name: 'dup', input: SAMPLE_GROUP }, { id: 'bad', input: { nope: 1 } }, null])
    const l = parseScenarios(raw)
    expect(l).toHaveLength(1)
    expect(projectGlobe(l[0].input).totals.topUp).toBeCloseTo(10_905_185, 1)
    expect(parseScenarios('not json')).toEqual([])
  })

  it('compare any two saved scenarios: JP April start moves JP from IIR to JP QDMTT', () => {
    const l = updateScenarioInput(addScenario(base, 'JP April', SAMPLE_GROUP, T, 's2'), 's2', { ...SAMPLE_GROUP, fiscalYearStart: '2026-04-01' }, T)
    const c = compareProjections(projectGlobe(l[0].input), projectGlobe(l[1].input), { a: l[0].name, b: l[1].name })
    const jp = c.rows.find((r) => r.code === 'JP')!
    expect(jp.a.iir).toBeCloseTo(897_408, 1)
    expect(jp.b.iir).toBe(0)
    expect(jp.b.domestic).toBeCloseTo(1_121_760, 1)
  })

  it('export / import: scenarios file and single group file; imported names made unique', () => {
    const json = scenariosToJson(base, T)
    const r = importScenarios(base, json, T, (i) => `imp-${i}`)
    expect(r.added).toBe(1)
    expect(r.list.map((s) => s.name)).toEqual(['Base FY2026', 'Base FY2026 (2)'])
    const single = importScenarios([], JSON.stringify(SAMPLE_GROUP), T, () => 'g1')
    expect(single.list[0]).toMatchObject({ id: 'g1', name: SAMPLE_GROUP.groupName })
    expect(importScenarios([], '{"x":1}', T, () => 'z').added).toBe(0)
  })

  it('migrates the legacy single scenario A slot', () => {
    const m = migrateLegacyScenarioA(JSON.stringify(SAMPLE_GROUP), T)
    expect(m).toHaveLength(1)
    expect(m[0].name).toBe(`Scenario A: ${SAMPLE_GROUP.groupName}`)
    expect(migrateLegacyScenarioA(null, T)).toEqual([])
  })
})
