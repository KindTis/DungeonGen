import markerBossUrl from '../assets/tiles/marker-boss.svg'
import markerStartUrl from '../assets/tiles/marker-start.svg'
import doorUrl from '../assets/tiles/tile-door.svg'
import floorAUrl from '../assets/tiles/tile-floor-a.svg'
import floorBUrl from '../assets/tiles/tile-floor-b.svg'
import wallUrl from '../assets/tiles/tile-wall.svg'

export interface TileSprites {
  floorA: HTMLImageElement
  floorB: HTMLImageElement
  wall: HTMLImageElement
  door: HTMLImageElement
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
  const [floorA, floorB, wall, door, start, boss] = await Promise.all([
    loadImage(floorAUrl),
    loadImage(floorBUrl),
    loadImage(wallUrl),
    loadImage(doorUrl),
    loadImage(markerStartUrl),
    loadImage(markerBossUrl),
  ])
  return {
    floorA,
    floorB,
    wall,
    door,
    start,
    boss,
  }
}

