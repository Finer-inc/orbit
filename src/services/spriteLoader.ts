import JSZip from 'jszip'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnimFrame {
  texture: THREE.Texture
  ratio: number // relative time weight (sums to 1.0 across all frames)
}

export interface SpriteData {
  textures: Map<string, THREE.Texture>  // "idle_front" etc → single-frame texture
  animFrames: Map<string, AnimFrame[]>  // "walk_front" etc → multi-frame animation
}

// ---------------------------------------------------------------------------
// Image helpers (ported from rpg-dot-maker PreviewStep.tsx)
// ---------------------------------------------------------------------------

function dataUrlToImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, img.width, img.height))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

function detectBgColor(imageData: ImageData): { r: number; g: number; b: number } {
  const { data, width, height } = imageData
  const colorCounts = new Map<string, { r: number; g: number; b: number; count: number }>()

  const sampleCorner = (cx: number, cy: number) => {
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 5; dx++) {
        const x = Math.min(Math.max(cx + dx, 0), width - 1)
        const y = Math.min(Math.max(cy + dy, 0), height - 1)
        const i = (y * width + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const key = `${r},${g},${b}`
        const existing = colorCounts.get(key)
        if (existing) {
          existing.count++
        } else {
          colorCounts.set(key, { r, g, b, count: 1 })
        }
      }
    }
  }

  sampleCorner(0, 0)
  sampleCorner(width - 5, 0)
  sampleCorner(0, height - 5)
  sampleCorner(width - 5, height - 5)

  let bestColor = { r: 255, g: 255, b: 255 }
  let bestCount = 0
  for (const entry of colorCounts.values()) {
    if (entry.count > bestCount) {
      bestCount = entry.count
      bestColor = { r: entry.r, g: entry.g, b: entry.b }
    }
  }
  return bestColor
}

function chromaKey(
  data: Uint8ClampedArray,
  bgColor: { r: number; g: number; b: number },
  threshold: number,
): void {
  for (let i = 0; i < data.length; i += 4) {
    const dr = Math.abs(data[i] - bgColor.r)
    const dg = Math.abs(data[i + 1] - bgColor.g)
    const db = Math.abs(data[i + 2] - bgColor.b)
    if (dr + dg + db < threshold) {
      data[i + 3] = 0
    }
  }
}

function createTextureFromImageData(imgData: ImageData): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = imgData.width
  canvas.height = imgData.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imgData, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

async function createTransparentTexture(
  dataUrl: string,
  bgColor: { r: number; g: number; b: number },
  threshold: number = 200,
): Promise<THREE.Texture> {
  const imgData = await dataUrlToImageData(dataUrl)
  chromaKey(imgData.data, bgColor, threshold)
  return createTextureFromImageData(imgData)
}

function createAnimFrameTexture(
  frameImageData: ImageData,
  bgColor: { r: number; g: number; b: number },
  threshold: number = 200,
): THREE.Texture {
  const clonedData = new Uint8ClampedArray(frameImageData.data)
  chromaKey(clonedData, bgColor, threshold)
  const newImgData = new ImageData(clonedData, frameImageData.width, frameImageData.height)
  return createTextureFromImageData(newImgData)
}

// ---------------------------------------------------------------------------
// Video frame extraction (ported from rpg-dot-maker loopDetector.ts)
// ---------------------------------------------------------------------------

async function extractFramesFromVideo(videoBlob: Blob): Promise<ImageData[]> {
  const url = URL.createObjectURL(videoBlob)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = url

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load video metadata'))
    })

    const duration = video.duration
    const width = video.videoWidth
    const height = video.videoHeight
    const fps = 30
    const dt = 1 / fps
    const totalFrames = Math.floor(duration * fps)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const frames: ImageData[] = []

    for (let i = 0; i < totalFrames; i++) {
      const targetTime = i * dt

      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          video.removeEventListener('error', onError)
          resolve()
        }
        const onError = () => {
          video.removeEventListener('seeked', onSeeked)
          video.removeEventListener('error', onError)
          reject(new Error(`Seek failed at t=${targetTime}`))
        }
        video.addEventListener('seeked', onSeeked)
        video.addEventListener('error', onError)
        video.currentTime = targetTime
      })

      ctx.drawImage(video, 0, 0, width, height)
      frames.push(ctx.getImageData(0, 0, width, height))
    }

    return frames
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------------------------------------------------------------------------
// ZIP parsing
// ---------------------------------------------------------------------------

export async function parseSpriteZip(
  file: File,
  onProgress?: (stage: string, pct: number) => void,
): Promise<SpriteData> {
  const zip = await JSZip.loadAsync(file)

  // Step 1: Extract PNGs as data URLs keyed by pose name
  const pngEntries: { key: string; dataUrl: string }[] = []
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir || !relativePath.toLowerCase().endsWith('.png')) continue
    const filename = relativePath.split('/').pop()!
    const key = filename.replace(/\.png$/i, '').replace(/^\d+_/, '')
    const blob = await zipEntry.async('blob')
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    pngEntries.push({ key, dataUrl })
  }

  if (pngEntries.length === 0) {
    throw new Error('ZIPから画像が見つかりません')
  }

  onProgress?.('背景色検出', 0)

  // Step 2: Detect background color from the first PNG
  const firstImgData = await dataUrlToImageData(pngEntries[0].dataUrl)
  const bgColor = detectBgColor(firstImgData)

  // Step 3: Create transparent textures for all PNGs
  const textures = new Map<string, THREE.Texture>()
  for (let i = 0; i < pngEntries.length; i++) {
    const { key, dataUrl } = pngEntries[i]
    onProgress?.('テクスチャ生成', ((i + 1) / pngEntries.length) * 50)
    textures.set(key, await createTransparentTexture(dataUrl, bgColor))
  }

  // Step 4: Extract MP4 frames and create animation textures
  const animFrames = new Map<string, AnimFrame[]>()
  const mp4Entries: { key: string; blob: Blob }[] = []
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir || !relativePath.toLowerCase().endsWith('.mp4')) continue
    const filename = relativePath.split('/').pop()!
    const dirKey = filename.replace(/\.mp4$/i, '')
    const blob = await zipEntry.async('blob')
    mp4Entries.push({ key: dirKey, blob })
  }

  for (let i = 0; i < mp4Entries.length; i++) {
    const { key, blob } = mp4Entries[i]
    onProgress?.(`動画フレーム抽出 (${key})`, 50 + ((i + 1) / mp4Entries.length) * 50)
    const frames = await extractFramesFromVideo(blob)
    if (frames.length > 0) {
      const ratio = 1 / frames.length
      animFrames.set(
        key,
        frames.map((f) => ({
          texture: createAnimFrameTexture(f, bgColor),
          ratio,
        })),
      )
    }
  }

  onProgress?.('完了', 100)
  return { textures, animFrames }
}
