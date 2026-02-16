import { describe, it, expect } from 'vitest';
import { parseCSS } from '../src/parser.js';

describe('Parser', () => {
  describe('Server Config', () => {
    it('should parse default port', () => {
      const css = `
        @server {
          port: 3000;
        }
      `;
      const result = parseCSS(css);
      expect(result.config.port).toBe(3000);
    });

    it('should parse env() with fallback', () => {
      const css = `
        @server {
          port: env(PORT, 8080);
          database: env(DATABASE, ./app.db);
        }
      `;
      const result = parseCSS(css);
      expect(result.config.port).toBe(8080);
      expect(result.config.database).toBe('./app.db');
    });

    it('should parse env() with actual env var', () => {
      process.env.MY_PORT = '5000';
      const css = `
        @server {
          port: env(MY_PORT, 3000);
        }
      `;
      const result = parseCSS(css);
      expect(result.config.port).toBe(5000);
      delete process.env.MY_PORT;
    });
  });

  describe('Route Parsing', () => {
    it('should parse basic GET route', () => {
      const css = `
        [path="/users"]:GET {
          @return json([]);
        }
      `;
      const result = parseCSS(css);
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/users');
      expect(result.routes[0].method).toBe('GET');
    });

    it('should parse POST route', () => {
      const css = `
        [path="/users"]:POST {
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].method).toBe('POST');
    });

    it('should parse PUT, PATCH, DELETE routes', () => {
      const css = `
        [path="/users/:id"]:PUT { @return json({}); }
        [path="/users/:id"]:PATCH { @return json({}); }
        [path="/users/:id"]:DELETE { @return json({}); }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].method).toBe('PUT');
      expect(result.routes[1].method).toBe('PATCH');
      expect(result.routes[2].method).toBe('DELETE');
    });

    it('should parse route with params', () => {
      const css = `
        [path="/users/:id"]:GET {
          @return json({ "id": "param(:id)" });
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].path).toBe('/users/:id');
    });

    it('should parse wildcard route', () => {
      const css = `
        [path="*"]:GET {
          status: 404;
          @return json({ "error": "Not found" });
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].path).toBe('*');
    });
  });

  describe('Variable Assignments', () => {
    it('should parse param() function', () => {
      const css = `
        [path="/users/:id"]:GET {
          --id: param(:id);
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].variables).toHaveLength(1);
      expect(result.routes[0].variables[0].name).toBe('id');
      expect(result.routes[0].variables[0].value.type).toBe('param');
    });

    it('should parse query() function', () => {
      const css = `
        [path="/search"]:GET {
          --q: query(q);
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].variables[0].value.type).toBe('query');
    });

    it('should parse body() function', () => {
      const css = `
        [path="/users"]:POST {
          --name: body(name);
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].variables[0].value.type).toBe('body');
    });

    it('should parse header() function', () => {
      const css = `
        [path="/admin"]:GET {
          --role: header(x-user-role);
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].variables[0].value.type).toBe('header');
    });

    it('should parse var() function', () => {
      const css = `
        [path="/test"]:GET {
          --x: 1;
          --y: var(--x);
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].variables[1].value.type).toBe('var');
    });
  });

  describe('SQL Parsing', () => {
    it('should parse SQL without args', () => {
      const css = `
        [path="/users"]:GET {
          @return json(sql("SELECT * FROM users"));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value;
      expect(returnVal.type).toBe('sql');
    });

    it('should parse SQL with args', () => {
      const css = `
        [path="/users/:id"]:GET {
          --id: param(:id);
          @return json(sql("SELECT * FROM users WHERE id = ?", var(--id)));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.type).toBe('sql');
      expect(returnVal.query).toBe('SELECT * FROM users WHERE id = ?');
      expect(returnVal.args).toHaveLength(1);
    });

    it('should parse SQL with multiple args', () => {
      const css = `
        [path="/users"]:POST {
          --name: body(name);
          --email: body(email);
          @return json(sql("INSERT INTO users (name, email) VALUES (?, ?)", var(--name), var(--email)));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.args).toHaveLength(2);
    });
  });

  describe('If Expression Parsing', () => {
    it('should parse simple truthy check', () => {
      const css = `
        [path="/test"]:GET {
          --x: 1;
          @return json(if(--x: "yes"; else: "no"));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.type).toBe('if');
      expect(returnVal.branches).toHaveLength(1);
      expect(returnVal.branches[0].condition.type).toBe('truthy');
    });

    it('should parse equality check', () => {
      const css = `
        [path="/test"]:GET {
          --role: header(x-role);
          @return json(if(--role = admin: "granted"; else: "denied"));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.branches[0].condition.type).toBe('equals');
    });

    it('should parse comparison operators', () => {
      const css = `
        [path="/test"]:GET {
          --age: body(age);
          @return json(if(
            --age > 18: "adult";
            --age < 13: "child";
            else: "teen"
          ));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.branches[0].condition.type).toBe('greaterThan');
      expect(returnVal.branches[1].condition.type).toBe('lessThan');
    });

    it('should parse not equals', () => {
      const css = `
        [path="/test"]:GET {
          --status: body(status);
          @return json(if(--status != banned: "ok"; else: "blocked"));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.branches[0].condition.type).toBe('notEquals');
    });

    it('should parse AND condition', () => {
      const css = `
        [path="/test"]:GET {
          --a: 1;
          --b: 1;
          @return json(if(--a and --b: "both"; else: "not both"));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.branches[0].condition.type).toBe('and');
    });

    it('should parse OR condition', () => {
      const css = `
        [path="/test"]:GET {
          --a: 0;
          --b: 1;
          @return json(if(--a or --b: "either"; else: "neither"));
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.branches[0].condition.type).toBe('or');
    });
  });

  describe('Status Parsing', () => {
    it('should parse literal status', () => {
      const css = `
        [path="/test"]:GET {
          status: 404;
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].status?.type).toBe('literal');
      expect(result.routes[0].status?.value).toBe(404);
    });

    it('should parse if status', () => {
      const css = `
        [path="/test"]:GET {
          --role: header(x-role);
          status: if(--role = admin: 200; else: 403);
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].status?.type).toBe('if');
    });
  });

  describe('Database Schema Parsing', () => {
    it('should parse single @database block', () => {
      const css = `
        @database {
          CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
          CREATE INDEX users_name ON users(name);
        }
      `;
      const result = parseCSS(css);
      expect(result.schema).toContain('CREATE TABLE users');
      expect(result.schema).toContain('CREATE INDEX users_name');
    });

    it('should return undefined when @database is missing', () => {
      const css = `
        [path="/"]:GET {
          @return json({});
        }
      `;
      const result = parseCSS(css);
      expect(result.schema).toBeUndefined();
    });
  });

  describe('Return Types', () => {
    it('should parse json return', () => {
      const css = `
        [path="/test"]:GET {
          @return json({ "message": "hello" });
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].return.type).toBe('json');
    });

    it('should parse html return', () => {
      const css = `
        [path="/test"]:GET {
          @return html("<h1>Hello</h1>");
        }
      `;
      const result = parseCSS(css);
      expect(result.routes[0].return.type).toBe('html');
    });

    it('should parse array return', () => {
      const css = `
        [path="/test"]:GET {
          @return json([]);
        }
      `;
      const result = parseCSS(css);
      const returnVal = result.routes[0].return.value as any;
      expect(returnVal.type).toBe('json');
      expect(returnVal.value).toEqual([]);
    });
  });
});
