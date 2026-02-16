import branchyPreset from '../presets/branchy.json'
import linearPreset from '../presets/linear.json'
import loopyPreset from '../presets/loopy.json'
import type { DungeonParams, DungeonStyle } from '../core/model'

type PresetValues = Pick<DungeonParams, 'roomCount' | 'branching' | 'loopChance'>

export const STYLE_PRESETS: Record<DungeonStyle, PresetValues> = {
  linear: linearPreset,
  branchy: branchyPreset,
  loopy: loopyPreset,
}

