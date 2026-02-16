import type { UiState } from './types'
import { STYLE_PRESETS } from './presets'

export const DEFAULT_UI_STATE: UiState = {
  seedInput: '123',
  style: 'branchy',
  roomCount: STYLE_PRESETS.branchy.roomCount,
  branching: STYLE_PRESETS.branchy.branching,
  loopChance: STYLE_PRESETS.branchy.loopChance,
  exportScale: 2,
  exportBackground: 'white',
}

