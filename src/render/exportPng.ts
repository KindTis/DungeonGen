type BackgroundMode = 'white' | 'transparent'

export interface ExportPngOptions {
  scale?: number
  background?: BackgroundMode
  margin?: number
}

function createBlobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export PNG blob.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

export async function exportCanvasToPng(
  canvas: HTMLCanvasElement,
  options: ExportPngOptions = {},
): Promise<Blob> {
  const scale = options.scale ?? 2
  const margin = options.margin ?? 24
  const background = options.background ?? 'white'

  const output = document.createElement('canvas')
  output.width = Math.round((canvas.width + margin * 2) * scale)
  output.height = Math.round((canvas.height + margin * 2) * scale)
  const context = output.getContext('2d')
  if (!context) {
    throw new Error('Unable to access PNG export context.')
  }

  if (background === 'white') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, output.width, output.height)
  } else {
    context.clearRect(0, 0, output.width, output.height)
  }

  context.imageSmoothingEnabled = true
  context.drawImage(
    canvas,
    0,
    0,
    canvas.width,
    canvas.height,
    margin * scale,
    margin * scale,
    canvas.width * scale,
    canvas.height * scale,
  )

  return createBlobFromCanvas(output)
}

export function downloadPng(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

