import Database from 'better-sqlite3'
import express from 'express'
import fs from 'fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDatabase } from '../src/evaluator.js'
import { parseCSS } from '../src/parser.js'
import { createApp } from '../src/runtime.js'

const TEST_DB_NAME = `test-int-${Date.now()}.db`
const TEST_DB = `./${TEST_DB_NAME}`

describe('Integration Tests', () => {
  let app: express.Express
  let server: ReturnType<express.Application['listen']>
  let db: Database.Database | null = null

  beforeAll(async () => {
    const css = `
      @server {
        port: 3333;
        database: ./${TEST_DB_NAME};
      }

      @database {
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT
        );
        INSERT INTO users (name, email) VALUES ('John', 'john@example.com');
      }

      [path="/"]:GET {
        @return html("<h1>Hello World</h1>");
      }

      [path="/users"]:GET {
        @return json(sql("SELECT * FROM users"));
      }

      [path="/users/:id"]:GET {
        --id: param(:id);
        --user: sql("SELECT * FROM users WHERE id = ?", var(--id));
        @return json(if(--user: var(--user); else: { "error": "Not found" }));
      }

      [path="/users"]:POST {
        --name: body(name);
        --email: body(email);
        @return json(sql("INSERT INTO users (name, email) VALUES (?, ?)", var(--name), var(--email)));
      }

      [path="/search"]:GET {
        --q: query(q);
        --results: sql("SELECT * FROM users WHERE name LIKE ?", var(--q));
        @return json(if(--q: var(--results); else: []));
      }

      [path="/ping"]:GET {
        @return json({ "ok": true });
      }

      [path="/admin"]:GET {
        --role: header(x-user-role);
        status: if(--role = admin: 200; else: 403);
        @return json(if(--role = admin: { "message": "Welcome" }; else: { "error": "Access denied" }));
      }

      [path="*"]:GET {
        status: 404;
        @return json({ "error": "Not found" });
      }
    `

    const parsed = parseCSS(css)
    app = createApp(parsed)
    db = new Database(TEST_DB)

    await new Promise<void>((resolve) => {
      server = app.listen(3333, () => resolve())
    })
  })

  afterAll(async () => {
    closeDatabase()
    if (db) {
      db.close()
      db = null
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB)
    }
  })

  async function fetchGet(path: string, headers: Record<string, string> = {}) {
    const res = await fetch(`http://localhost:3333${path}`, { headers })
    const text = await res.text()
    try {
      return { status: res.status, body: JSON.parse(text) }
    } catch {
      return { status: res.status, body: text }
    }
  }

  async function fetchPost(path: string, body: unknown) {
    const res = await fetch(`http://localhost:3333${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try {
      return { status: res.status, body: JSON.parse(text) }
    } catch {
      return { status: res.status, body: text }
    }
  }

  it('should return HTML for root path', async () => {
    const res = await fetchGet('/')
    expect(res.status).toBe(200)
    expect(res.body).toBe('<h1>Hello World</h1>')
  })

  it('should return users list', async () => {
    const res = await fetchGet('/users')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('John')
  })

  it('should return single user by id', async () => {
    const res = await fetchGet('/users/1')
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(1)
    expect(res.body.name).toBe('John')
  })

  it('should return error for non-existent user', async () => {
    const res = await fetchGet('/users/999')
    expect(res.status).toBe(200)
    expect(res.body.error).toBe('Not found')
  })

  it('should create new user', async () => {
    const res = await fetchPost('/users', {
      name: 'Jane',
      email: 'jane@example.com',
    })
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(2)
    expect(res.body.changes).toBe(1)
  })

  it('should search users with query', async () => {
    const res = await fetchGet('/search?q=John')
    expect(res.status).toBe(200)
  })

  it('should return empty array without query', async () => {
    const res = await fetchGet('/search')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('should grant access with admin role', async () => {
    const res = await fetchGet('/admin', { 'x-user-role': 'admin' })
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Welcome')
  })

  it('should deny access without admin role', async () => {
    const res = await fetchGet('/admin')
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Access denied')
  })

  it('should return 404 for unknown route', async () => {
    const res = await fetchGet('/unknown')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Not found')
  })

  it('should handle array query params as comma-separated', async () => {
    const res = await fetchGet('/search?q=John&q=Jane')
    expect(res.status).toBe(200)
  })

  it('should return JSON content type for json route', async () => {
    const res = await fetch(`http://localhost:3333/ping`)
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})
