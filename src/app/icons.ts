import bossIconUrl from '../assets/icons/icon-boss.svg'
import startIconUrl from '../assets/icons/icon-start.svg'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load icon: ${src}`))
    image.src = src
  })
}

export async function loadIconAssets(): Promise<Record<'start' | 'boss', HTMLImageElement | null>> {
  const [start, boss] = await Promise.all([loadImage(startIconUrl), loadImage(bossIconUrl)])
  return { start, boss }
}

