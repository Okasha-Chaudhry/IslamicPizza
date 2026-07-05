const sharp = require('sharp')
const pngToIcoModule = require('png-to-ico')
const pngToIco = pngToIcoModule.default || pngToIcoModule
const fs = require('fs')

async function run() {
  // Circle mask: square logo ko gol kaat do (red corners ghayab)
  const size = 512
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  )
  const trimmed = await sharp('resources/logo-source.webp')
    .trim()
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: circle, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const base = sharp(trimmed).flatten({ background: '#ffffff' })

  await sharp(trimmed)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile('src/renderer/src/assets/logo.png')

  const sizes = [16, 24, 32, 48, 64, 128, 256]
  for (const s of sizes) {
    await base
      .clone()
      .resize(s, s, { fit: 'contain', background: '#ffffff' })
      .png()
      .toFile(`resources/icon-${s}.png`)
  }

  const buf = await pngToIco(sizes.map((s) => `resources/icon-${s}.png`))
  fs.writeFileSync('build/icon.ico', buf)

  fs.copyFileSync('resources/icon-256.png', 'build/icon.png')
  fs.copyFileSync('resources/icon-256.png', 'resources/icon.png')

  console.log('Done: build/icon.ico, build/icon.png, resources/icon.png, src/renderer/src/assets/logo.png')
}
run().catch((e) => { console.error(e); process.exit(1) })