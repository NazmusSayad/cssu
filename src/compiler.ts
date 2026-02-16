import { Request, Response } from 'express'
import { evaluateExpression } from './evaluator.js'
import { HttpMethod, RequestContext, RouteRule } from './types.js'

export interface CompiledRoute {
  path: string
  method: HttpMethod
  handler: (req: Request, res: Response) => Promise<void>
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

function createHandler(
  route: RouteRule
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response) => {
    const ctx: RequestContext = {
      params: req.params,
      query: req.query as Record<string, string>,
      body: req.body || {},
      headers: req.headers as Record<string, string>,
      variables: {},
    }

    for (const variable of route.variables) {
      ctx.variables[variable.name] = evaluateExpression(variable.value, ctx)
    }

    if (route.status) {
      const statusValue =
        route.status.type === 'literal'
          ? (route.status.value as number)
          : (evaluateExpression(route.status.value as any, ctx) as number)
      res.status(statusValue)
    }

    const result = evaluateExpression(route.return.value, ctx)

    if (route.return.type === 'json') {
      res.json(result)
    } else {
      res.send(result)
    }
  }
}
