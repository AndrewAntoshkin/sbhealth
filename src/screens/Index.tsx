import { CaretLeft } from '@phosphor-icons/react'
import { IndexContent } from '../IndexContent'
import type { SystemId } from '../data/systems'
import { Dock, type DockTab } from './Dock'

/** Индекс здоровья отдельной страницей: как он считается и что на него влияет. */
export function IndexPage({ onBack, onTab, onAtlas }: { onBack: () => void; onTab: (tab: DockTab) => void; onAtlas: (id: SystemId) => void }) {
  return (
    <>
      <main className="screen ixpage">
        <div className="ixp-wrap">
          <header className="ixp-head">
            <button type="button" className="back" aria-label="Назад" onClick={onBack}>
              <CaretLeft size={20} weight="bold" aria-hidden="true" />
            </button>
            <div>
              <h1>Индекс здоровья</h1>
              <p>Как это считается</p>
            </div>
          </header>
          <IndexContent onSelect={onAtlas} />
        </div>
      </main>
      <Dock active={null} onGo={(tab) => onTab(tab)} />
    </>
  )
}
