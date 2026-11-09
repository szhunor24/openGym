import { Fragment } from 'react'

function numberText(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return '—'

  return value.toLocaleString('hu-HU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function durationText(value) {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return '—'
  }

  const total = Math.round(value)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

function Metric({ label, value, unit }) {
  return (
    <div
      style={{
        background: 'var(--surface-3)',
        borderRadius: 12,
        padding: '12px 14px',
        minWidth: 0,
      }}
    >
      <div className="small muted" style={{ marginBottom: 4 }}>
        {label}
      </div>

      <div style={{ fontSize: 22, fontWeight: 600 }}>
        {value}

        {value !== '—' && unit && (
          <span
            className="small muted"
            style={{ marginLeft: 5, fontWeight: 400 }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value, unit }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--sep)',
      }}
    >
      <span className="small muted">{label}</span>

      <span style={{ textAlign: 'right' }}>
        {value}
        {value !== '—' && unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

export default function GarminRunDetails({ workout }) {
  const run = workout?.garmin

  if (!run) return null

  const raw = run.raw || {}

  const speed = (
    Number.isFinite(run.distance) &&
    Number.isFinite(run.durationSeconds) &&
    run.durationSeconds > 0
  )
    ? run.distance / (run.durationSeconds / 3600)
    : null

  return (
    <section
      style={{
        margin: '14px 0 20px',
        textAlign: 'start',
      }}
    >
      <div
        className="small muted"
        style={{ marginBottom: 10, lineHeight: 1.5 }}
      >
        Garmin Connect
        {' · '}
        {run.activityType === 'Treadmill Running'
          ? 'Futópados futás'
          : 'Szabadtéri futás'}

        <div>
          Eredeti kezdés: {run.startedAtLocal}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Metric
          label="Távolság"
          value={numberText(run.distance, 2)}
          unit="km"
        />

        <Metric
          label="Időtartam"
          value={durationText(run.durationSeconds)}
        />

        <Metric
          label="Átlagtempó"
          value={durationText(run.avgPaceSeconds)}
          unit="perc/km"
        />

        <Metric
          label="Átlagpulzus"
          value={numberText(run.avgHeartRate)}
          unit="bpm"
        />
      </div>

      <h4>Idő és intenzitás</h4>

      <DetailRow
        label="Mozgásidő"
        value={durationText(run.movingSeconds)}
      />

      <DetailRow
        label="Teljes eltelt idő"
        value={durationText(run.elapsedSeconds)}
      />

      <DetailRow
        label="Átlagsebesség, távból és időből számítva"
        value={numberText(speed, 2)}
        unit="km/h"
      />

      <DetailRow
        label="Legjobb tempó, Garmin-export szerint"
        value={durationText(run.bestPaceSeconds)}
        unit="perc/km"
      />

      <DetailRow
        label="Maximális pulzus"
        value={numberText(run.maxHeartRate)}
        unit="bpm"
      />

      <DetailRow
        label="Kalória"
        value={numberText(run.calories)}
        unit="kcal"
      />

      <h4 style={{ marginTop: 18 }}>Futómozgás</h4>

      <DetailRow
        label="Átlagos lépésfrekvencia"
        value={numberText(run.avgCadence)}
        unit="lépés/perc"
      />

      <DetailRow
        label="Maximális lépésfrekvencia"
        value={numberText(run.maxCadence)}
        unit="lépés/perc"
      />

      <DetailRow
        label="Átlagos lépéshossz"
        value={numberText(run.avgStrideLength, 2)}
        unit="m"
      />

      <DetailRow
        label="Lépésszám"
        value={numberText(run.steps)}
      />

      <h4 style={{ marginTop: 18 }}>Szintadatok</h4>

      <DetailRow
        label="Összes emelkedés"
        value={numberText(run.ascent)}
        unit="m"
      />

      <DetailRow
        label="Összes ereszkedés"
        value={numberText(run.descent)}
        unit="m"
      />

      <DetailRow
        label="Legkisebb magasság"
        value={numberText(run.minElevation)}
        unit="m"
      />

      <DetailRow
        label="Legnagyobb magasság"
        value={numberText(run.maxElevation)}
        unit="m"
      />

      <h4 style={{ marginTop: 18 }}>Körök</h4>

      <DetailRow
        label="Körök száma"
        value={numberText(run.lapCount)}
      />

      <DetailRow
        label="Legjobb kör ideje"
        value={durationText(run.bestLapSeconds)}
      />

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer' }}>
          Összes eredeti Garmin-mező
        </summary>

        <div
          className="small"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '7px 12px',
            marginTop: 12,
            overflowWrap: 'anywhere',
          }}
        >
          {Object.entries(raw).map(([name, value]) => (
            <Fragment key={name}>
              <span className="muted">{name}</span>
              <span>{value === '' ? '—' : String(value)}</span>
            </Fragment>
          ))}
        </div>
      </details>

      <div
        className="small dim"
        style={{ marginTop: 14, lineHeight: 1.5 }}
      >
        Ezek az importált Garmin-adatok. Az openGymben végzett
        későbbi edzésszerkesztés nem számolja újra automatikusan
        ezt az összefoglalót.
      </div>
    </section>
  )
}