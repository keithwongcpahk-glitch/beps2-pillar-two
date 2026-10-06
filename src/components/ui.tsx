import type { ReactNode } from 'react'

export function PageHeader(props: { eyebrow?: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {props.eyebrow && <span className="eyebrow">{props.eyebrow}</span>}
        <h2>{props.title}</h2>
        <p>{props.subtitle}</p>
      </div>
      {props.actions && <div className="page-actions">{props.actions}</div>}
    </header>
  )
}

const JUR_NAMES: Record<string, string> = { OECD: 'OECD', HK: 'Hong Kong', SG: 'Singapore', JP: 'Japan', OTHER: 'Other' }

export function JurBadge(props: { code: string; long?: boolean }) {
  const c = props.code.toLowerCase()
  return (
    <span className={`badge jur jur-${c}`} title={JUR_NAMES[props.code] ?? props.code}>
      {props.long ? JUR_NAMES[props.code] ?? props.code : props.code}
    </span>
  )
}

export function Tag(props: { tone?: 'ok' | 'warn' | 'muted' | 'info' | 'danger'; children: ReactNode; title?: string }) {
  return (
    <span className={`tag tag-${props.tone ?? 'muted'}`} title={props.title}>
      {props.children}
    </span>
  )
}

export function SourceTypeTag(props: { type: 'official' | 'secondary' }) {
  return props.type === 'official' ? <Tag tone="ok">Official</Tag> : <Tag tone="info" title="Secondary source (adviser / law-firm / press)">Secondary</Tag>
}

export function VerifiedTag(props: { verified: boolean; note?: string }) {
  return props.verified ? (
    <Tag tone="ok" title={props.note}>Verified</Tag>
  ) : (
    <Tag tone="warn" title={props.note ?? 'Not verified against a primary source'}>Unverified</Tag>
  )
}

export function SourceLink(props: { url: string; label?: string }) {
  let host = props.url
  try {
    host = new URL(props.url).hostname.replace(/^www\./, '')
  } catch {
    /* keep raw */
  }
  return (
    <a className="source-link" href={props.url} target="_blank" rel="noopener noreferrer" title={props.url}>
      {props.label ?? host} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

export function EmptyState(props: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{props.title}</strong>
      {props.children && <div className="fine">{props.children}</div>}
    </div>
  )
}

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; size?: 'sm' }) {
  return (
    <div className={`segmented${props.size === 'sm' ? ' sm' : ''}`} role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.value} type="button" className={o.value === props.value ? 'on' : ''} aria-pressed={o.value === props.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Callout(props: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return <div className={`callout callout-${props.tone ?? 'info'}`}>{props.children}</div>
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${y}`
}
