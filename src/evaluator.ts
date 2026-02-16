import Database from 'better-sqlite3'
import { Condition, Expression, RequestContext } from './types.js'

let db: Database.Database | null = null

export function initDatabase(dbPath: string): void {
  db = new Database(dbPath)
}

export function executeSchema(schema: string): void {
  if (!db) {
    throw new Error('Database not initialized')
  }
  db.exec(schema)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function evaluateExpression(
  expr: Expression,
  ctx: RequestContext
): unknown {
  switch (expr.type) {
    case 'literal':
      return expr.value

    case 'var':
      return ctx.variables[expr.name]

    case 'param':
      return ctx.params[expr.paramName]

    case 'query':
      return ctx.query[expr.paramName]

    case 'body':
      return ctx.body[expr.fieldName]

    case 'header':
      return ctx.headers[expr.headerName.toLowerCase()]

    case 'sql':
      return evaluateSql(expr.query, expr.args, ctx)

    case 'if':
      return evaluateIf(expr.branches, expr.elseValue, ctx)

    case 'json':
      return expr.value

    case 'html':
      return expr.value

    case 'concat':
      return expr.parts.map((part) => evaluateExpression(part, ctx)).join('')

    default:
      return null
  }
}

function evaluateSql(
  query: string,
  args: Expression[],
  ctx: RequestContext
): unknown {
  if (!db) {
    return { error: 'Database not configured' }
  }

  const evaluatedArgs = args.map((arg) => evaluateExpression(arg, ctx))

  try {
    const stmt = db.prepare(query)

    if (query.trim().toUpperCase().startsWith('SELECT')) {
      if (query.includes('LIMIT 1') || args.length === 1) {
        const result = stmt.get(...evaluatedArgs)
        return result || null
      }
      return stmt.all(...evaluatedArgs)
    }

    if (query.trim().toUpperCase().startsWith('INSERT')) {
      const result = stmt.run(...evaluatedArgs)
      return { id: result.lastInsertRowid, changes: result.changes }
    }

    if (
      query.trim().toUpperCase().startsWith('UPDATE') ||
      query.trim().toUpperCase().startsWith('DELETE')
    ) {
      const result = stmt.run(...evaluatedArgs)
      return { changes: result.changes }
    }

    return stmt.run(...evaluatedArgs)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

function evaluateIf(
  branches: { condition: Condition; value: Expression }[],
  elseValue: Expression | undefined,
  ctx: RequestContext
): unknown {
  for (const branch of branches) {
    if (evaluateCondition(branch.condition, ctx)) {
      return evaluateExpression(branch.value, ctx)
    }
  }

  if (elseValue) {
    return evaluateExpression(elseValue, ctx)
  }

  return null
}

function evaluateCondition(condition: Condition, ctx: RequestContext): boolean {
  switch (condition.type) {
    case 'truthy': {
      const value = ctx.variables[condition.varName]
      if (value === null || value === undefined) return false
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value !== 0
      if (typeof value === 'string') return value.length > 0
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0
      }
      return true
    }

    case 'equals': {
      const value = ctx.variables[condition.varName]
      return value === condition.value
    }

    case 'notEquals': {
      const value = ctx.variables[condition.varName]
      return value !== condition.value
    }

    case 'greaterThan': {
      const value = ctx.variables[condition.varName]
      return typeof value === 'number' && value > condition.value
    }

    case 'lessThan': {
      const value = ctx.variables[condition.varName]
      return typeof value === 'number' && value < condition.value
    }

    case 'greaterOrEqual': {
      const value = ctx.variables[condition.varName]
      return typeof value === 'number' && value >= condition.value
    }

    case 'lessOrEqual': {
      const value = ctx.variables[condition.varName]
      return typeof value === 'number' && value <= condition.value
    }

    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, ctx))

    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, ctx))

    case 'not':
      return !evaluateCondition(condition.condition, ctx)

    default:
      return false
  }
}
