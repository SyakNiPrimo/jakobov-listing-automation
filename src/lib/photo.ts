import sharp from 'sharp'

/**
 * Apply blur-fill treatment: center the original image sharp and uncropped
 * in a square (or portrait) frame, filling remaining space with a blurred
 * zoomed version of the same image.
 */
export async function applyBlurFill(
  inputBuffer: Buffer,
  targetWidth = 1080,
  targetHeight = 1080,
): Promise<Buffer> {
  const meta = await sharp(inputBuffer).metadata()
  const srcW = meta.width!
  const srcH = meta.height!

  // Scale original to fit inside the target frame without cropping
  const scaleToFit = Math.min(targetWidth / srcW, targetHeight / srcH)
  const fittedW = Math.round(srcW * scaleToFit)
  const fittedH = Math.round(srcH * scaleToFit)

  const offsetX = Math.round((targetWidth - fittedW) / 2)
  const offsetY = Math.round((targetHeight - fittedH) / 2)

  // Create blurred background: fill entire frame by zooming + blurring the original
  const bgScale = Math.max(targetWidth / srcW, targetHeight / srcH)
  const bgW = Math.round(srcW * bgScale)
  const bgH = Math.round(srcH * bgScale)
  const bgOffsetX = Math.round((bgW - targetWidth) / 2)
  const bgOffsetY = Math.round((bgH - targetHeight) / 2)

  const background = await sharp(inputBuffer)
    .resize(bgW, bgH)
    .extract({
      left: bgOffsetX,
      top: bgOffsetY,
      width: targetWidth,
      height: targetHeight,
    })
    .blur(20)
    .toBuffer()

  // Sharp foreground (original, fitted)
  const foreground = await sharp(inputBuffer)
    .resize(fittedW, fittedH)
    .toBuffer()

  // Composite foreground centered on blurred background
  const result = await sharp(background)
    .composite([{ input: foreground, left: offsetX, top: offsetY }])
    .jpeg({ quality: 88 })
    .toBuffer()

  return result
}

export async function fetchAndProcess(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return applyBlurFill(buf)
}
