import { parseCSV, importId } from './import-csv.js'

function readNumber(value) {
  const text = String(value ?? '').trim()

  if (!text || text === '--') return null

  const cleaned = text
    .replace(/^'/, '')
    .replace(/,/g, '')

  const number = Number(cleaned)

  return Number.isFinite(number) ? number : null
}

// HH:MM:SS.s vagy MM:SS.s → másodperc
function readSeconds(value) {
  const text = String(value ?? '').trim()

  if (!text || text.includes('--')) return null

  const parts = text.split(':').map(Number)

  if (
    ![2, 3].includes(parts.length) ||
    parts.some(n => !Number.isFinite(n) || n < 0)
  ) {
    return null
  }

  const seconds = parts.at(-1)
  const minutes = parts.at(-2)

  if (seconds >= 60) return null
  if (parts.length === 3 && minutes >= 60) return null

  return parts.length === 3
    ? parts[0] * 3600 + minutes * 60 + seconds
    : minutes * 60 + seconds
}

export function parseGarminCSV(text) {
  const rows = parseCSV(text)

  if (rows.length < 2) {
    return { error: 'empty' }
  }

  const headers = rows[0].map(h => String(h).trim())
  const required = ['Activity Type', 'Date', 'Distance', 'Time']

  if (!required.every(name => headers.includes(name))) {
    return { error: 'unrecognised' }
  }

  const runs = []
  const issues = []
  let skippedOther = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]

    if (row.length !== headers.length) {
      issues.push({
        row: i + 1,
        message: 'Az oszlopok száma nem egyezik a fejléccel.',
      })
      continue
    }

    const raw = Object.fromEntries(
      headers.map((name, index) => [name, row[index] ?? ''])
    )

    const type = raw['Activity Type'].trim()

    if (!['Running', 'Treadmill Running'].includes(type)) {
      skippedOther++
      continue
    }

    const distance = readNumber(raw.Distance)
    const durationSeconds = readSeconds(raw.Time)
    const startedAtLocal = raw.Date.trim()

    if (
      distance === null || distance <= 0 ||
      durationSeconds === null || durationSeconds <= 0 ||
      !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startedAtLocal)
    ) {
      issues.push({
        row: i + 1,
        message: 'Hibás dátumformátum, távolság vagy időtartam.',
      })
      continue
    }

    runs.push({
      source: 'Garmin Connect',
      activityType: type,
      title: raw.Title || type,

      // Egyelőre nincs időzóna- vagy mértékegység-konverzió.
      startedAtLocal,
      distance,
      durationSeconds,

      movingSeconds: readSeconds(raw['Moving Time']),
      elapsedSeconds: readSeconds(raw['Elapsed Time']),
      avgPaceSeconds: readSeconds(raw['Avg Pace']),
      bestPaceSeconds: readSeconds(raw['Best Pace']),

      calories: readNumber(raw.Calories),
      avgHeartRate: readNumber(raw['Avg HR']),
      maxHeartRate: readNumber(raw['Max HR']),
      avgCadence: readNumber(raw['Avg Run Cadence']),
      maxCadence: readNumber(raw['Max Run Cadence']),
      avgStrideLength: readNumber(raw['Avg Stride Length']),
      steps: readNumber(raw.Steps),

      ascent: readNumber(raw['Total Ascent']),
      descent: readNumber(raw['Total Descent']),
      minElevation: readNumber(raw['Min Elevation']),
      maxElevation: readNumber(raw['Max Elevation']),

      lapCount: readNumber(raw['Number of Laps']),
      bestLapSeconds: readSeconds(raw['Best Lap Time']),

      raw,
    })
  }

  return {
    source: 'Garmin Connect',
    runs,
    issues,
    skippedOther,
  }
}

const GARMIN_RUNNING_ID = 'garmin-running'
const GARMIN_TREADMILL_ID = 'garmin-treadmill'

function garminWorkout(run) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    .exec(run.startedAtLocal)

  if (!m) throw new Error('Hibás Garmin-dátum.')

  const [, year, month, day, hour, minute, second] = m.map(Number)

  // Első verzió: az időpontot ezen a gépen helyi időként értelmezzük.
  const date = new Date(
    year, month - 1, day, hour, minute, second
  )

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    throw new Error(`Nem értelmezhető helyi időpont: ${run.startedAtLocal}`)
  }

  if (
    !Number.isFinite(run.distance) ||
    run.distance <= 0 ||
    !Number.isFinite(run.durationSeconds) ||
    run.durationSeconds <= 0
  ) {
    throw new Error('Hibás Garmin-távolság vagy időtartam.')
  }

  const start = date.getTime()
  const exerciseId = run.activityType === 'Treadmill Running'
    ? GARMIN_TREADMILL_ID
    : GARMIN_RUNNING_ID

  // Nem függ a számítógép időzónájától vagy az edzés átnevezésétől.
  // Ez nem Garmin-aktivitásazonosító, hanem az exportból képzett kulcs.
  const id = importId(
    'gw',
    `${run.activityType}|${run.startedAtLocal}`
  )

  return {
    id,
    d: run.startedAtLocal.slice(0, 10),
    start,
    end: start + run.durationSeconds * 1000,
    routineId: null,
    name: run.title,
    entries: [{
      id: exerciseId,
      sets: [{
        min: run.durationSeconds / 60,
        speed: run.distance / (run.durationSeconds / 3600),
        done: true,
      }],
      topW: null,
    }],
    prs: [],
    vol: 0,

    garmin: {
      ...JSON.parse(JSON.stringify(run)),
      schemaVersion: 1,
      distanceUnit: 'km',
      paceUnit: 'min/km',
      elevationUnit: 'm',
      timeInterpretation: 'import-device-local',
    },
  }
}

export function mergeGarminRuns(state, runs) {
  // Előbb mindent ellenőrzünk, csak utána módosítjuk az állapotot.
  const candidates = runs.map(garminWorkout)
  const existing = state.workouts || []
  const seen = new Set(existing.map(workout => workout.id))
  const fresh = []

  for (const workout of candidates) {
    if (seen.has(workout.id)) continue

    seen.add(workout.id)
    fresh.push(workout)
  }

  if (!fresh.length) {
    return { added: 0, skipped: candidates.length }
  }

  const exercises = [
    {
      id: GARMIN_RUNNING_ID,
      n: 'Garmin Running',
      custom: true,
      eq: 'custom',
      bp: 'cardio',
      tg: '',
      desc: '',
    },
    {
      id: GARMIN_TREADMILL_ID,
      n: 'Garmin Treadmill Running',
      custom: true,
      eq: 'custom',
      bp: 'cardio',
      tg: '',
      desc: '',
    },
  ]

  const used = new Set(
    fresh.flatMap(workout => workout.entries.map(entry => entry.id))
  )
  const customs = state.customEx || []
  const known = new Set(customs.map(exercise => exercise.id))

  state.customEx = [
    ...customs,
    ...exercises.filter(exercise =>
      used.has(exercise.id) && !known.has(exercise.id)
    ),
  ]

  state.workouts = [...existing, ...fresh].sort((a, b) =>
    a.d.localeCompare(b.d) || a.start - b.start
  )

  return {
    added: fresh.length,
    skipped: candidates.length - fresh.length,
  }
}