import { Request, RequestHandler, Response } from 'express'
import { evaluateExpression } from './evaluator.js'
import { HttpMethod, RequestContext, RouteRule } from './types.js'

export interface CompiledRoute {
  path: string
  method: HttpMethod
  handler: RequestHandler
}

export function compileRoutes(routes: RouteRule[]): CompiledRoute[] {
  return routes.map(compileRoute)
}

function compileRoute(route: RouteRule): CompiledRoute {
  return {
    path: route.path,
    method: route.method,
    handler: createHandler(route),
  }
}

function createHandler(route: RouteRule): RequestHandler {
  return (req: Request, res: Response) => {
    const ctx: RequestContext = {
      params: normalizeParams(req.params),
      query: normalizeQuery(req.query),
      body: normalizeBody(req.body),
      headers: normalizeHeaders(req.headers),
      variables: {},
    }

    for (const variable of route.variables) {
      ctx.variables[variable.name] = evaluateExpression(variable.value, ctx)
    }

    if (route.status) {
      const statusValue =
        route.status.type === 'literal'
          ? route.status.value
          : Number(evaluateExpression(route.status.value, ctx))
      if (Number.isFinite(statusValue)) {
        res.status(statusValue)
      }
    }

    const result = evaluateExpression(route.return.value, ctx)

    if (route.return.type === 'json') {
      res.json(result)
    } else {
      res.send(typeof result === 'string' ? result : String(result))
    }
  }
}

function normalizeQuery(query: Request['query']): Record<string, string> {
  const normalized: Record<string, string> = {}

  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      normalized[key] = value.map((item) => String(item)).join(',')
    } else if (value === undefined) {
      normalized[key] = ''
    } else {
      normalized[key] = String(value)
    }
  })

  return normalized
}

function normalizeParams(params: Request['params']): Record<string, string> {
  const normalized: Record<string, string> = {}

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      normalized[key] = value.map((item) => String(item)).join(',')
    } else {
      normalized[key] = String(value)
    }
  })

  return normalized
}

function normalizeHeaders(headers: Request['headers']): Record<string, string> {
  const normalized: Record<string, string> = {}

  Object.entries(headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.join(',')
    } else if (value === undefined) {
      normalized[key.toLowerCase()] = ''
    } else {
      normalized[key.toLowerCase()] = String(value)
    }
  })

  return normalized
}

function normalizeBody(body: Request['body']): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {}
  }

  return body as Record<string, unknown>
}
