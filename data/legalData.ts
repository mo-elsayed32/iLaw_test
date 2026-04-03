import fs from 'fs'
import path from 'path'

let cachedDocs: any[] | null = null

export function loadLegalData(): any[] {
  if (cachedDocs) return cachedDocs

  const filePath = path.join(
    process.cwd(),
    'data',
    'civil_code',
    'civil_full.json'
  )

  cachedDocs = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return cachedDocs
}
