import sharp from 'sharp'

async function makeIcon(size, file) {
  const fontSize = Math.round(size * 0.42)
  const radius = Math.round(size * 0.18)
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#1A3022"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="600" fill="#FAF7F2">S</text>
</svg>`)
  await sharp(svg).png().toFile(file)
}

await makeIcon(192, 'public/icons/icon-192.png')
await makeIcon(512, 'public/icons/icon-512.png')
await makeIcon(180, 'public/icons/apple-touch-icon.png')
await makeIcon(32, 'public/icons/favicon-32.png')
console.log('icons ok')
