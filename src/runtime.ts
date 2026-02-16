import express, { Express, Request, Response } from 'express'
import { CompiledRoute, compileRoutes } from './compiler.js'
import { closeDatabase, executeSchema, initDatabase } from './evaluator.js'
import { ParsedCSS, ServerConfig } from './types.js'

export function createApp(parsed: ParsedCSS): Express {
  const app = express()

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  if (parsed.config.database) {
    initDatabase(parsed.config.database)
    if (parsed.schema) {
      executeSchema(parsed.schema)
    }
  }

  const compiledRoutes = compileRoutes(parsed.routes)

  for (const route of compiledRoutes) {
    registerRoute(app, route)
  }

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' })
  })

  return app
}

function registerRoute(app: Express, route: CompiledRoute): void {
  switch (route.method) {
    case 'GET':
      app.get(route.path, route.handler)
      break
    case 'POST':
      app.post(route.path, route.handler)
      break
    case 'PUT':
      app.put(route.path, route.handler)
      break
    case 'PATCH':
      app.patch(route.path, route.handler)
      break
    case 'DELETE':
      app.delete(route.path, route.handler)
      break
    case 'HEAD':
      app.head(route.path, route.handler)
      break
    case 'OPTIONS':
      app.options(route.path, route.handler)
      break
  }
}

export function startServer(app: Express, config: ServerConfig): void {
  const host = config.host || 'localhost'

  app.listen(config.port, () => {
    console.log(`CSS Server running at http://${host}:${config.port}`)
    if (config.database) {
      console.log(`Database: ${config.database}`)
    }
  })
}

export function stopServer(): void {
  closeDatabase()
}
