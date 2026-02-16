#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { parseCSS } from './parser.js'
import { createApp, startServer } from './runtime.js'

const file = process.argv[2]

if (!file) {
  console.error('Usage: css-server <file.css>')
  process.exit(1)
}

const filePath = path.resolve(file)

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`)
  process.exit(1)
}

const css = fs.readFileSync(filePath, 'utf8')

try {
  const parsed = parseCSS(css)

  console.log(`Loading CSS server from: ${filePath}`)
  console.log(`Found ${parsed.routes.length} route(s)`)

  const app = createApp(parsed)
  startServer(app, parsed.config)
} catch (error) {
  console.error(`Error parsing CSS: ${(error as Error).message}`)
  process.exit(1)
}
