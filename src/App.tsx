import { flushSync } from 'react-dom'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { SYSTEMS, type SystemId } from './data/systems'
import { Home } from './screens/Home'
import { Start } from './screens/Start'

// Атлас (и в нём 3D) — отдельный чанк: стартовый и главный экраны не платят за three.js
const loadAtlas = () => import('./screens/Atlas')
const Atlas = lazy(() => loadAtlas().then((m) => ({ default: m.Atlas })))

type Route = { name: 'start' } | { name: 'home' } | { name: 'atlas'; id: SystemId | null }

function parse(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/')
  if (name === 'home') return { name: 'home' }
  if (name === 'atlas') return { name: 'atlas', id: SYSTEMS.some((item) => item.id === id) ? (id as SystemId) : null }
  return { name: 'start' }
}


export function App() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      const next = parse(window.location.hash)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const swap = () => flushSync(() => setRoute(next))
      if (!reduce && 'startViewTransition' in document) (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(swap)
      else swap()
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const go = useCallback((to: string) => {
    if (window.location.hash !== to) window.location.hash = to
  }, [])

  // пока человек читает стартовый и главный экраны, докачиваем атлас и модель
  useEffect(() => {
    if (route.name === 'atlas') return
    const timer = window.setTimeout(() => {
      void loadAtlas()
      void import('./scene/BodyCanvas')
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [route.name])

  // service worker стартует, когда первый экран уже нарисован
  useEffect(() => {
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('atlas-ready')), 1500)
    return () => window.clearTimeout(timer)
  }, [])

  if (route.name === 'start') return <Start onStart={() => go('#/home')} />
  if (route.name === 'home') return <Home onAtlas={(id) => go(id ? `#/atlas/${id}` : '#/atlas')} />
  return (
    <Suspense fallback={<div className="app atlas" />}>
      <Atlas key={route.id ?? 'all'} initial={route.id} onHome={() => go('#/home')} />
    </Suspense>
  )
}
