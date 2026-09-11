import fs from 'fs'
import sharp from 'sharp'

async function save(src, dest) {
  await sharp(src)
    .resize(1600, 1600, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .webp({ quality: 92 })
    .toFile(dest)
  console.log('wrote', dest)
}

await save(
  'C:/Users/Aayush/.cursor/projects/c-VI-Corporate-Gifting-giffter/assets/new-joiner-onboarding-kit.png',
  'public/site/home-new-joiner.webp',
)
await save(
  'C:/Users/Aayush/.cursor/projects/c-VI-Corporate-Gifting-giffter/assets/client-appreciation-hamper.png',
  'public/site/home-client-appreciation.webp',
)

const updates = JSON.parse(fs.readFileSync('tmp/catalogue-fill-updates.json', 'utf8'))
const skip = new Set([
  'd957fdd1-dd5b-4d13-8052-f7c2a5c85370',
  'd1000000-0000-4000-8000-00000000000f',
  '6d4901c1-a107-4368-aaf0-58c168eaeb43',
  '17a085da-27ae-4ef5-8446-19a0996c54ae',
  'fb495145-c1de-4a34-b70f-e45053fe6cf6',
])

const rows = updates.filter((u) => !skip.has(u.id) && fs.existsSync(`public/catalogue-fill/${u.id}.webp`))
const chunkSize = 40
const statements = []
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize)
  const values = chunk.map((u) => `('${u.id}'::uuid, '${u.path}')`).join(',\n')
  statements.push(
    `update products p set image_url = v.url from (values ${values}) as v(id, url) where p.id = v.id;`,
  )
}
fs.writeFileSync('tmp/apply-catalogue-fill.sql', statements.join('\n\n'))
console.log({ rows: rows.length, statements: statements.length })
