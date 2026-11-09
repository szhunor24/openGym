import { describe, it, expect } from 'vitest'
import { parseGarminCSV, mergeGarminRuns } from './import-garmin.js'
import { mergeStates } from './sync-merge.js'

describe('Garmin CSV import', () => {
  it('beolvassa a futást és megőrzi az eredeti mezőket', () => {
    const csv = [
      'Activity Type,Date,Title,Distance,Time,Calories,Avg HR,Min Elevation,Steps',
      `Running,2026-10-01 10:00:00,Test Run,5.00,00:30:00.5,"1,362",--,'-12,"4,762"`,
    ].join('\n')

    const result = parseGarminCSV(csv)
    const run = result.runs[0]

    expect(result.runs).toHaveLength(1)
    expect(result.issues).toHaveLength(0)
    expect(run.distance).toBe(5)
    expect(run.durationSeconds).toBe(1800.5)
    expect(run.calories).toBe(1362)
    expect(run.avgHeartRate).toBeNull()
    expect(run.minElevation).toBe(-12)
    expect(run.steps).toBe(4762)
    expect(run.raw.Title).toBe('Test Run')
  })

  it('külön kezeli a futópados futást', () => {
    const csv = [
      'Activity Type,Date,Distance,Time',
      'Treadmill Running,2026-10-01 10:00:00,3.00,00:20:00',
    ].join('\n')

    const result = parseGarminCSV(csv)

    expect(result.runs[0].activityType).toBe('Treadmill Running')
  })

  it('jelzi a hibás időtartamot', () => {
    const csv = [
      'Activity Type,Date,Distance,Time',
      'Running,2026-10-01 10:00:00,5.00,--:--:--',
    ].join('\n')

    const result = parseGarminCSV(csv)

    expect(result.runs).toHaveLength(0)
    expect(result.issues).toHaveLength(1)
  })
})
describe('Garmin mentés', () => {
  const exampleRuns = () => parseGarminCSV([
    'Activity Type,Date,Title,Distance,Time,Avg HR',
    'Running,2026-10-01 10:00:00,Test Run,5.00,00:30:00,160',
  ].join('\n')).runs

  it('megtartja az aznapi másik edzést és nem duplikál', () => {
    const state = {
      workouts: [{
        id: 'existing-gym-workout',
        d: '2026-10-01',
        start: new Date(2026, 9, 1, 8).getTime(),
        entries: [],
      }],
      customEx: [],
    }

    const first = mergeGarminRuns(state, exampleRuns())
    const second = mergeGarminRuns(state, exampleRuns())

    expect(first.added).toBe(1)
    expect(second.added).toBe(0)
    expect(second.skipped).toBe(1)
    expect(state.workouts).toHaveLength(2)

    const run = state.workouts.find(workout => workout.garmin)

    expect(run.garmin.distance).toBe(5)
    expect(run.garmin.raw['Avg HR']).toBe('160')
    expect(run.entries[0].sets[0].speed).toBe(10)
  })

  it('JSON-mentés és kliensoldali összevonás után is megőrzi az adatokat', () => {
    const state = {
      unit: 'kg',
      workouts: [],
      customEx: [],
      routines: [],
      bodyweight: [],
      exWeights: {},
    }

    mergeGarminRuns(state, exampleRuns())

    const restored = JSON.parse(JSON.stringify(state))
    const other = {
      ...restored,
      workouts: [],
      customEx: [],
    }

    const merged = mergeStates(other, restored)

    expect(merged.workouts).toHaveLength(1)
    expect(merged.workouts[0].garmin.raw['Avg HR']).toBe('160')
    expect(merged.workouts[0].garmin.durationSeconds).toBe(1800)
  })
})