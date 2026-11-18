import type { TurtlePose } from '../turtle/Stage'

function format(n: number): string {
  // Round first, so float dust from turning never shows as "100.0" or "-0.0".
  const rounded = Math.round(n * 10) / 10 + 0
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function StatusBar({ pose, python }: { pose: TurtlePose | null; python: 'loading' | 'ready' | 'failed' }) {
  return (
    <div className="status-bar">
      {python !== 'ready' && <span className="python-state">{python === 'loading' ? 'Python is loading…' : 'Python could not start. Reload the page.'}</span>}
      {pose && <>
        <span>x: {format(pose.x)} y: {format(pose.y)}</span>
        <span>heading: {format(pose.heading)}°</span>
        <span>pen color: <span className="color-swatch" style={{ backgroundColor: pose.color }} /></span>
      </>}
    </div>
  )
}
