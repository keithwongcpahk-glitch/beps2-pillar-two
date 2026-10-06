import { useEffect, useState } from 'react'

/** Tiny hash router (no dependency): #/updates, #/jurisdictions/jp, ... */
export type Route = { page: string; sub: string | null }

export const PAGES = ['home', 'dashboard', 'results', 'group', 'scenarios', 'overview', 'inputs', 'updates', 'jurisdictions', 'changes', 'about'] as const
export type Page = (typeof PAGES)[number]

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const page = (PAGES as readonly string[]).includes(parts[0] ?? '') ? parts[0] : 'home'
  return { page, sub: parts[1] ?? null }
}

export function href(page: Page, sub?: string): string {
  return `#/${page}${sub ? `/${sub}` : ''}`
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(typeof window === 'undefined' ? '' : window.location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
