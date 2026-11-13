import { flushSync } from 'react-dom'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { SYSTEMS, type SystemId } from './data/systems'
import { Home } from './screens/Home'
import { Messages } from './screens/Messages'
import { Profile } from './screens/Profile'
import { DoctorProfile, Doctors } from './screens/Doctors'
import { Learn } from './screens/Learn'
import type { DockTab } from './screens/Dock'
import { Toaster } from './Toaster'
import { Start } from './screens/Start'
import { Assistant } from './screens/Assistant'

// Атлас (и в нём 3D) — отдельный чанк: стартовый и главный экраны не платят за three.js
const loadAtlas = () => import('./screens/Atlas')
const Atlas = lazy(() => loadAtlas().then((m) => ({ default: m.Atlas })))

type Route = { name: 'start' } | { name: 'home'; open?: 'index' } | { name: 'doctors'; id: string | null } | { name: 'learn'; id: string | null } | { name: 'messages'; id: string | null } | { name: 'profile' } | { name: 'atlas'; id: SystemId | null } | { name: 'assistant'; id: SystemId | null }

function parse(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/')
  if (name === 'home') return { name: 'home', open: id === 'index' ? id : undefined }
  if (name === 'profile') return { name: 'profile' }
  if (name === 'doctors') return { name: 'doctors', id: id || null }
  if (name === 'learn') return { name: 'learn', id: id || null }
  if (name === 'messages') return { name: 'messages', id: id || null }
  if (name === 'assistant') return { name: 'assistant', id: SYSTEMS.some((item) => item.id === id) ? (id as SystemId) : null }
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

  const onTab = (tab: DockTab) => {
    if (tab === 'home') go('#/home')
    if (tab === 'atlas') go('#/atlas')
    if (tab === 'messages') go('#/messages')
    if (tab === 'doctors') go('#/doctors')
  }

  let screen
  if (route.name === 'start') screen = <Start onStart={() => go('#/atlas')} />
  else if (route.name === 'home') screen = <Home key={route.open ?? 'home'} open={route.open} go={go} onAtlas={(id) => go(id ? `#/atlas/${id}` : '#/atlas')} />
  else if (route.name === 'profile') screen = <Profile go={go} onAtlas={(id) => go(id ? `#/atlas/${id}` : '#/atlas')} onTab={onTab} />
  else if (route.name === 'doctors') screen = route.id ? <DoctorProfile key={route.id} id={route.id} go={go} onAtlas={(id) => go(`#/atlas/${id}`)} /> : <Doctors go={go} onTab={onTab} />
  else if (route.name === 'learn') screen = <Learn id={route.id} go={go} onTab={onTab} onAtlas={(id) => go(`#/atlas/${id}`)} />
  else if (route.name === 'assistant') screen = <Assistant key={route.id ?? 'all'} about={route.id} go={go} />
  else if (route.name === 'messages') screen = <Messages threadId={route.id} go={go} onTab={onTab} />
  else
    screen = (
      <Suspense fallback={<div className="app atlas" />}>
        <Atlas key={route.id ?? 'all'} initial={route.id} onTab={onTab} go={go} />
      </Suspense>
    )

  return (
    <>
      {screen}
      <Toaster onGo={go} />
    </>
  )
}
