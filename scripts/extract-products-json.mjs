import fs from 'fs'

const raw = fs.readFileSync(
  'C:/Users/Aayush/.cursor/projects/c-VI-Corporate-Gifting-giffter/agent-tools/d9ea5680-fbc8-4e42-a324-bf42d964d105.txt',
  'utf8',
)
const outer = JSON.parse(raw)
const start = outer.result.indexOf('\n[')
const end = outer.result.lastIndexOf(']\n')
const json = outer.result.slice(start + 1, end + 1)
const products = JSON.parse(json)
fs.mkdirSync('tmp', { recursive: true })
fs.writeFileSync('tmp/products-for-crop.json', JSON.stringify(products))
console.log(products.length)
