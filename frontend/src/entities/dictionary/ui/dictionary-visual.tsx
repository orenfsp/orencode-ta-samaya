import type { AnyDictionaryItem, DictionaryKey } from '../model/types'
import { AgeScale } from './age-scale'
import { RankLadder } from './rank-ladder'
import { AcademicTrack } from './visuals/academic-track'
import { DisciplineTiles } from './visuals/discipline-tiles'
import { EventPreview } from './visuals/event-preview'
import { JudgePanel } from './visuals/judge-panel'
import { JudgeValidity } from './visuals/judge-validity'
import { LevelRings } from './visuals/level-rings'
import { MunicipalityStructure } from './visuals/municipality-structure'
import { OrganizationClusters } from './visuals/organization-clusters'

/** Тематическая визуализация справочника. Клик по элементу открывает карточку записи */
export function DictionaryVisual({
  dictionaryKey,
  items,
  onSelect,
}: {
  dictionaryKey: DictionaryKey
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  switch (dictionaryKey) {
    case 'disciplines':
      return <DisciplineTiles items={items} onSelect={onSelect} />
    case 'municipalities':
      return <MunicipalityStructure items={items} onSelect={onSelect} />
    case 'organization_types':
      return <OrganizationClusters items={items} onSelect={onSelect} />
    case 'academic_groups':
      return <AcademicTrack items={items} onSelect={onSelect} />
    case 'age_groups':
      return <AgeScale groups={items} onSelect={onSelect} />
    case 'contest_types':
      return <EventPreview mode="type" items={items} onSelect={onSelect} />
    case 'contest_levels':
      return <LevelRings items={items} onSelect={onSelect} />
    case 'contest_formats':
      return <EventPreview mode="format" items={items} onSelect={onSelect} />
    case 'rank_types':
      return <RankLadder ranks={items} onSelect={onSelect} />
    case 'judge_categories':
      return <JudgeValidity items={items} onSelect={onSelect} />
    case 'judge_positions':
      return <JudgePanel items={items} onSelect={onSelect} />
  }
}
