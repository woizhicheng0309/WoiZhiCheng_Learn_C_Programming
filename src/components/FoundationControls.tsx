export function FoundationRangeControl({
  id,
  label,
  description,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  description: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="foundation-control">
      <div className="foundation-control-heading">
        <label htmlFor={`${id}-number`}><span>{label}</span><small>{description}</small></label>
        <input
          id={`${id}-number`}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.trunc(next))))
          }}
        />
      </div>
      <input
        className="foundation-range"
        type="range"
        aria-label={`${label}滑桿`}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="foundation-range-bounds" aria-hidden="true"><span>{min}</span><span>{max}</span></div>
    </div>
  )
}
