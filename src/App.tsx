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

type Motion = 'push' | 'pop' | 'tab'

const WIDE = '(min-width: 960px), (orientation: landscape) and (min-width: 640px) and (max-height: 520px)'

/** Глубина экрана в стеке: вкладки — 0, всё, во что проваливаются, — глубже. */
function depth(route: Route): number {
  if (route.name === 'start') return -1
  if (route.name === 'doctors' || route.name === 'messages') return route.id ? 1 : 0
  if (route.name === 'learn') return route.id ? 2 : 1
  if (route.name === 'profile' || route.name === 'assistant') return 1
  return 0
}

/** Как сменить экран: въехать справа, уехать вправо, мягко сменить вкладку — или без анимации. */
function motionOf(prev: Route, next: Route): Motion | null {
  const a = depth(prev)
  const b = depth(next)
  if (prev.name === next.name && a === 0 && b === 0) return null
  if (prev.name === 'messages' && next.name === 'messages' && window.matchMedia(WIDE).matches) return null
  if (a < 0) return 'tab'
  if (b > a) return 'push'
  if (b < a) return 'pop'
  return b === 0 ? 'tab' : 'push'
}

type ViewTransition = { finished: Promise<void> }
type WithTransitions = Document & { startViewTransition?: (cb: () => void) => ViewTransition }

// где человек остановился на каждом экране: при возврате назад и между вкладками прокрутка сохраняется
const scrollMemory = new Map<string, number>()
const screenEl = () => document.querySelector<HTMLElement>('.screen')

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
    let current = parse(window.location.hash)
    let currentHash = window.location.hash
    let token = 0
    // свайп «назад» в Safari уже сам анимирует смену страницы — свою анимацию поверх не запускаем
    let uaTransition = false
    const onPop = (event: PopStateEvent) => {
      uaTransition = Boolean((event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition)
    }

    const onChange = () => {
      const next = parse(window.location.hash)
      const nextHash = window.location.hash
      const motion = motionOf(current, next)
      const native = uaTransition
      uaTransition = false
      scrollMemory.set(currentHash, screenEl()?.scrollTop ?? 0)
      current = next
      currentHash = nextHash

      const swap = () => {
        flushSync(() => setRoute(next))
        const el = screenEl()
        if (el && (motion === 'pop' || motion === 'tab')) el.scrollTop = scrollMemory.get(nextHash) ?? 0
      }

      const doc = document as WithTransitions
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!motion || native || reduce || !doc.startViewTransition) {
        swap()
        return
      }
      const mine = ++token
      document.documentElement.dataset.nav = motion
      doc.startViewTransition(swap).finished.finally(() => {
        if (mine === token) delete document.documentElement.dataset.nav
      })
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onChange)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('hashchange', onChange)
    }
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
  else if (route.name === 'home') screen = <Home open={route.open} go={go} onAtlas={(id) => go(id ? `#/atlas/${id}` : '#/atlas')} />
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
