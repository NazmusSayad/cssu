import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDatabase,
  evaluateExpression,
  initDatabase,
} from '../src/evaluator.js'
import { Expression, RequestContext } from '../src/types.js'

describe('Evaluator', () => {
  let ctx: RequestContext
  let testDbPath: string
  let testDb: Database.Database | null = null

  beforeEach(() => {
    ctx = {
      params: {},
      query: {},
      body: {},
      headers: {},
      variables: {},
    }

    testDbPath = path.join(
      process.cwd(),
      `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    )
  })

  afterEach(() => {
    closeDatabase()
    if (testDb) {
      testDb.close()
      testDb = null
    }
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath)
      } catch (_error) {}
    }
  })

  describe('Literal expressions', () => {
    it('should evaluate string literal', () => {
      const expr: Expression = { type: 'literal', value: 'hello' }
      expect(evaluateExpression(expr, ctx)).toBe('hello')
    })

    it('should evaluate number literal', () => {
      const expr: Expression = { type: 'literal', value: 42 }
      expect(evaluateExpression(expr, ctx)).toBe(42)
    })

    it('should evaluate boolean literal', () => {
      const expr: Expression = { type: 'literal', value: true }
      expect(evaluateExpression(expr, ctx)).toBe(true)
    })

    it('should evaluate null literal', () => {
      const expr: Expression = { type: 'literal', value: null }
      expect(evaluateExpression(expr, ctx)).toBe(null)
    })
  })

  describe('Request context functions', () => {
    it('should evaluate param()', () => {
      ctx.params = { id: '123' }
      const expr: Expression = { type: 'param', paramName: 'id' }
      expect(evaluateExpression(expr, ctx)).toBe('123')
    })

    it('should evaluate query()', () => {
      ctx.query = { q: 'search term' }
      const expr: Expression = { type: 'query', paramName: 'q' }
      expect(evaluateExpression(expr, ctx)).toBe('search term')
    })

    it('should evaluate body()', () => {
      ctx.body = { name: 'John', email: 'john@example.com' }
      const expr: Expression = { type: 'body', fieldName: 'name' }
      expect(evaluateExpression(expr, ctx)).toBe('John')
    })

    it('should evaluate header()', () => {
      ctx.headers = { 'x-user-role': 'admin' }
      const expr: Expression = { type: 'header', headerName: 'x-user-role' }
      expect(evaluateExpression(expr, ctx)).toBe('admin')
    })

    it('should evaluate header() case-insensitively', () => {
      ctx.headers = { 'x-user-role': 'admin' }
      const expr: Expression = { type: 'header', headerName: 'X-User-Role' }
      expect(evaluateExpression(expr, ctx)).toBe('admin')
    })
  })

  describe('Variable references', () => {
    it('should evaluate var()', () => {
      ctx.variables = { user: { id: 1, name: 'John' } }
      const expr: Expression = { type: 'var', name: 'user' }
      expect(evaluateExpression(expr, ctx)).toEqual({ id: 1, name: 'John' })
    })

    it('should return undefined for missing var', () => {
      const expr: Expression = { type: 'var', name: 'missing' }
      expect(evaluateExpression(expr, ctx)).toBeUndefined()
    })
  })

  describe('SQL expressions', () => {
    beforeEach(() => {
      testDb = new Database(testDbPath)
      testDb.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT
        )
      `)
      testDb.exec(
        `INSERT INTO users (name, email) VALUES ('John', 'john@example.com')`
      )
      testDb.exec(
        `INSERT INTO users (name, email) VALUES ('Jane', 'jane@example.com')`
      )
      testDb.close()
      testDb = null
      initDatabase(testDbPath)
    })

    it('should execute SELECT all', () => {
      const expr: Expression = {
        type: 'sql',
        query: 'SELECT * FROM users',
        args: [],
      }
      const result = evaluateExpression(expr, ctx)
      expect(Array.isArray(result)).toBe(true)
      const rows = result as Array<{ name?: string }>
      expect(rows).toHaveLength(2)
      expect(rows[0].name).toBe('John')
    })

    it('should execute SELECT with params', () => {
      const expr: Expression = {
        type: 'sql',
        query: 'SELECT * FROM users WHERE id = ?',
        args: [{ type: 'literal', value: 1 }],
      }
      const result = evaluateExpression(expr, ctx)
      expect(result).toEqual({ id: 1, name: 'John', email: 'john@example.com' })
    })

    it('should execute INSERT', () => {
      const expr: Expression = {
        type: 'sql',
        query: 'INSERT INTO users (name, email) VALUES (?, ?)',
        args: [
          { type: 'literal', value: 'Bob' },
          { type: 'literal', value: 'bob@example.com' },
        ],
      }
      const result = evaluateExpression(expr, ctx)
      const insertResult = result as { id: number; changes: number }
      expect(insertResult.id).toBe(3)
      expect(insertResult.changes).toBe(1)
    })

    it('should execute UPDATE', () => {
      const expr: Expression = {
        type: 'sql',
        query: 'UPDATE users SET name = ? WHERE id = ?',
        args: [
          { type: 'literal', value: 'Johnny' },
          { type: 'literal', value: 1 },
        ],
      }
      const result = evaluateExpression(expr, ctx)
      const updateResult = result as { changes: number }
      expect(updateResult.changes).toBe(1)
    })

    it('should execute DELETE', () => {
      const expr: Expression = {
        type: 'sql',
        query: 'DELETE FROM users WHERE id = ?',
        args: [{ type: 'literal', value: 1 }],
      }
      const result = evaluateExpression(expr, ctx)
      const deleteResult = result as { changes: number }
      expect(deleteResult.changes).toBe(1)
    })
  })

  describe('SQL without database', () => {
    it('should return error when database not configured', () => {
      const expr: Expression = {
        type: 'sql',
        query: 'SELECT * FROM users',
        args: [],
      }
      const result = evaluateExpression(expr, ctx)
      expect(result).toEqual({ error: 'Database not configured' })
    })
  })

  describe('If expressions', () => {
    it('should return first truthy branch', () => {
      ctx.variables = { user: { id: 1 } }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'truthy', varName: 'user' },
            value: { type: 'literal', value: 'found' },
          },
        ],
        elseValue: { type: 'literal', value: 'not found' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('found')
    })

    it('should return else when no branch matches', () => {
      ctx.variables = { user: null }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'truthy', varName: 'user' },
            value: { type: 'literal', value: 'found' },
          },
        ],
        elseValue: { type: 'literal', value: 'not found' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('not found')
    })

    it('should evaluate equals condition', () => {
      ctx.variables = { role: 'admin' }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'equals', varName: 'role', value: 'admin' },
            value: { type: 'literal', value: 'granted' },
          },
        ],
        elseValue: { type: 'literal', value: 'denied' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('granted')
    })

    it('should evaluate notEquals condition', () => {
      ctx.variables = { status: 'active' }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: {
              type: 'notEquals',
              varName: 'status',
              value: 'banned',
            },
            value: { type: 'literal', value: 'ok' },
          },
        ],
        elseValue: { type: 'literal', value: 'blocked' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('ok')
    })

    it('should evaluate greaterThan condition', () => {
      ctx.variables = { age: 25 }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'greaterThan', varName: 'age', value: 18 },
            value: { type: 'literal', value: 'adult' },
          },
        ],
        elseValue: { type: 'literal', value: 'minor' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('adult')
    })

    it('should evaluate lessThan condition', () => {
      ctx.variables = { age: 12 }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'lessThan', varName: 'age', value: 13 },
            value: { type: 'literal', value: 'child' },
          },
        ],
        elseValue: { type: 'literal', value: 'teen or adult' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('child')
    })

    it('should evaluate AND condition', () => {
      ctx.variables = { a: true, b: true }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: {
              type: 'and',
              conditions: [
                { type: 'truthy', varName: 'a' },
                { type: 'truthy', varName: 'b' },
              ],
            },
            value: { type: 'literal', value: 'both' },
          },
        ],
        elseValue: { type: 'literal', value: 'not both' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('both')
    })

    it('should evaluate OR condition', () => {
      ctx.variables = { a: false, b: true }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: {
              type: 'or',
              conditions: [
                { type: 'truthy', varName: 'a' },
                { type: 'truthy', varName: 'b' },
              ],
            },
            value: { type: 'literal', value: 'either' },
          },
        ],
        elseValue: { type: 'literal', value: 'neither' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('either')
    })

    it('should evaluate NOT condition', () => {
      ctx.variables = { blocked: false }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: {
              type: 'not',
              condition: { type: 'truthy', varName: 'blocked' },
            },
            value: { type: 'literal', value: 'allowed' },
          },
        ],
        elseValue: { type: 'literal', value: 'blocked' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('allowed')
    })

    it('should evaluate multiple branches', () => {
      ctx.variables = { role: 'moderator' }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'equals', varName: 'role', value: 'admin' },
            value: { type: 'literal', value: 'full access' },
          },
          {
            condition: { type: 'equals', varName: 'role', value: 'moderator' },
            value: { type: 'literal', value: 'limited access' },
          },
        ],
        elseValue: { type: 'literal', value: 'no access' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('limited access')
    })
  })

  describe('JSON/HTML expressions', () => {
    it('should return json value', () => {
      const expr: Expression = { type: 'json', value: { message: 'hello' } }
      expect(evaluateExpression(expr, ctx)).toEqual({ message: 'hello' })
    })

    it('should return html value', () => {
      const expr: Expression = { type: 'html', value: '<h1>Hello</h1>' }
      expect(evaluateExpression(expr, ctx)).toBe('<h1>Hello</h1>')
    })
  })

  describe('Truthy checks', () => {
    it('should treat null as falsy', () => {
      ctx.variables = { x: null }
      const condition = { type: 'truthy', varName: 'x' } as const
      const expr: Expression = {
        type: 'if',
        branches: [{ condition, value: { type: 'literal', value: 'yes' } }],
        elseValue: { type: 'literal', value: 'no' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('no')
    })

    it('should treat undefined as falsy', () => {
      ctx.variables = { x: undefined }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'truthy', varName: 'x' },
            value: { type: 'literal', value: 'yes' },
          },
        ],
        elseValue: { type: 'literal', value: 'no' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('no')
    })

    it('should treat empty string as falsy', () => {
      ctx.variables = { x: '' }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'truthy', varName: 'x' },
            value: { type: 'literal', value: 'yes' },
          },
        ],
        elseValue: { type: 'literal', value: 'no' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('no')
    })

    it('should treat empty array as falsy', () => {
      ctx.variables = { x: [] }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'truthy', varName: 'x' },
            value: { type: 'literal', value: 'yes' },
          },
        ],
        elseValue: { type: 'literal', value: 'no' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('no')
    })

    it('should treat non-empty object as truthy', () => {
      ctx.variables = { x: { id: 1 } }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'truthy', varName: 'x' },
            value: { type: 'literal', value: 'yes' },
          },
        ],
        elseValue: { type: 'literal', value: 'no' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('yes')
    })

    it('should treat number 0 as falsy', () => {
      ctx.variables = { x: 0 }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'truthy', varName: 'x' },
            value: { type: 'literal', value: 'yes' },
          },
        ],
        elseValue: { type: 'literal', value: 'no' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('no')
    })

    it('should treat non-zero number as truthy', () => {
      ctx.variables = { x: 42 }
      const expr: Expression = {
        type: 'if',
        branches: [
          {
            condition: { type: 'truthy', varName: 'x' },
            value: { type: 'literal', value: 'yes' },
          },
        ],
        elseValue: { type: 'literal', value: 'no' },
      }
      expect(evaluateExpression(expr, ctx)).toBe('yes')
    })
  })
})
