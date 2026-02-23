import type { LightKind, PropKind } from '../core/tilemap'
import markerBossUrl from '../assets/tiles/marker-boss.svg'
import markerStartUrl from '../assets/tiles/marker-start.svg'
import doorFrameUrl from '../assets/tiles/tile-door-frame.svg'
import doorHUrl from '../assets/tiles/tile-door-h.svg'
import doorVUrl from '../assets/tiles/tile-door-v.svg'
import floorAUrl from '../assets/tiles/tile-floor-a.svg'
import floorBUrl from '../assets/tiles/tile-floor-b.svg'
import floorCUrl from '../assets/tiles/tile-floor-c.svg'
import floorDUrl from '../assets/tiles/tile-floor-d.svg'
import lightBrazierUrl from '../assets/tiles/light-brazier.svg'
import lightFlameSmallUrl from '../assets/tiles/light-flame-small.svg'
import lightTorchUrl from '../assets/tiles/light-torch.svg'
import propBannerUrl from '../assets/tiles/prop-banner.svg'
import propBarrelUrl from '../assets/tiles/prop-barrel.svg'
import propBonesUrl from '../assets/tiles/prop-bones.svg'
import propChestUrl from '../assets/tiles/prop-chest.svg'
import propCrateUrl from '../assets/tiles/prop-crate.svg'
import propPillarUrl from '../assets/tiles/prop-pillar.svg'
import propRubbleUrl from '../assets/tiles/prop-rubble.svg'
import wallCapUrl from '../assets/tiles/tile-wall-cap.svg'
import wallCornerInnerUrl from '../assets/tiles/tile-wall-corner-inner.svg'
import wallCornerOuterUrl from '../assets/tiles/tile-wall-corner-outer.svg'
import wallFaceUrl from '../assets/tiles/tile-wall-face.svg'

export type WallVariantKey = 'face' | 'cap' | 'innerCorner' | 'outerCorner'

export interface TileSprites {
  floorVariants: HTMLImageElement[]
  wallVariants: Record<WallVariantKey, HTMLImageElement>
  doorHorizontal: HTMLImageElement
  doorVertical: HTMLImageElement
  doorFrame: HTMLImageElement
  props: Record<PropKind, HTMLImageElement>
  lights: Record<LightKind, HTMLImageElement>
  start: HTMLImageElement
  boss: HTMLImageElement
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load asset: ${src}`))
    image.src = src
  })
}

export async function loadTileSprites(): Promise<TileSprites> {
  const [
    floorA,
    floorB,
    floorC,
    floorD,
    wallFace,
    wallCap,
    wallCornerInner,
    wallCornerOuter,
    doorHorizontal,
    doorVertical,
    doorFrame,
    propCrate,
    propBarrel,
    propBones,
    propPillar,
    propRubble,
    propBanner,
    propChest,
    lightTorch,
    lightBrazier,
    lightFlameSmall,
    start,
    boss,
  ] = await Promise.all([
    loadImage(floorAUrl),
    loadImage(floorBUrl),
    loadImage(floorCUrl),
    loadImage(floorDUrl),
    loadImage(wallFaceUrl),
    loadImage(wallCapUrl),
    loadImage(wallCornerInnerUrl),
    loadImage(wallCornerOuterUrl),
    loadImage(doorHUrl),
    loadImage(doorVUrl),
    loadImage(doorFrameUrl),
    loadImage(propCrateUrl),
    loadImage(propBarrelUrl),
    loadImage(propBonesUrl),
    loadImage(propPillarUrl),
    loadImage(propRubbleUrl),
    loadImage(propBannerUrl),
    loadImage(propChestUrl),
    loadImage(lightTorchUrl),
    loadImage(lightBrazierUrl),
    loadImage(lightFlameSmallUrl),
    loadImage(markerStartUrl),
    loadImage(markerBossUrl),
  ])
  return {
    floorVariants: [floorA, floorB, floorC, floorD],
    wallVariants: {
      face: wallFace,
      cap: wallCap,
      innerCorner: wallCornerInner,
      outerCorner: wallCornerOuter,
    },
    doorHorizontal,
    doorVertical,
    doorFrame,
    props: {
      crate: propCrate,
      barrel: propBarrel,
      bones: propBones,
      pillar: propPillar,
      rubble: propRubble,
      banner: propBanner,
      chest: propChest,
    },
    lights: {
      torch: lightTorch,
      brazier: lightBrazier,
      'flame-small': lightFlameSmall,
    },
    start,
    boss,
  }
}
