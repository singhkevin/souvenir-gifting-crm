import { writeFileSync } from 'node:fs'
import { homepageSeedSql } from '../src/lib/homepage/seed-sql'

const path = 'supabase/migrations/20261022_homepage_cms_seed.sql'
writeFileSync(path, homepageSeedSql())
console.log(`wrote ${path}`)
