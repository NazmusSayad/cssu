# Requirements

## Functional Requirements

### FR-01: CSS-Based Routing

The system SHALL allow defining HTTP routes using CSS selector syntax.

**Syntax:**

```css
[path='<route-path>']:http_method {
  /* route body */
}
```

**Supported Methods:**

- GET
- POST
- PUT
- PATCH
- DELETE
- HEAD
- OPTIONS

**Examples:**

```css
[path='/users']:get {
}
[path='/users/:id']:get {
}
[path='/users']:post {
}
[path='*']:get {
} /* catch-all */
```

### FR-02: Server Configuration

The system SHALL support server configuration via `@server` at-rule.

**Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `port` | number | Server port (default: 3000) |
| `database` | string | SQLite database path |
| `host` | string | Server host binding |

**Environment Variables:**

```css
@server {
  port: env(PORT, 3000);
  database: env(DATABASE_PATH, ./app.db);
}
```

### FR-03: Request Data Extraction

The system SHALL provide functions to extract data from HTTP requests.

| Function       | Description            | Example                       |
| -------------- | ---------------------- | ----------------------------- |
| `param(:name)` | Route parameter        | `--id: param(:id)`            |
| `query(name)`  | Query string parameter | `--q: query(q)`               |
| `body(name)`   | Request body field     | `--name: body(name)`          |
| `header(name)` | HTTP header            | `--role: header(x-user-role)` |

### FR-04: Variable System

The system SHALL support CSS custom properties for variable assignments.

**Syntax:**

```css
--variable-name: expression;
```

**Usage:**

```css
--id: param(: id);
--user: sql('SELECT * FROM users WHERE id = ?', var(--id));
@return json(var(--user));
```

### FR-05: SQL Query Execution

The system SHALL support SQLite queries via `sql()` function.

**Syntax:**

```css
sql("query", arg1, arg2, ...)
```

**Examples:**

```css
sql("SELECT * FROM users")
sql("SELECT * FROM users WHERE id = ?", var(--id))
sql("INSERT INTO users (name) VALUES (?)", var(--name))
```

**Return Values:**
| Query Type | Return |
|------------|--------|
| SELECT | Array of rows or single row |
| INSERT | `{ id: lastInsertRowid, changes: number }` |
| UPDATE | `{ changes: number }` |
| DELETE | `{ changes: number }` |

### FR-06: Conditional Logic

The system SHALL support conditional expressions via `if()` function.

**Syntax:**

```css
if(
  condition: value;
  condition: value;
  else: default_value;
)
```

**Condition Types:**

| Type             | Syntax            | Description                   |
| ---------------- | ----------------- | ----------------------------- |
| Truthy           | `--var`           | Variable is truthy            |
| Equals           | `--var = value`   | Variable equals value         |
| Not Equals       | `--var != value`  | Variable does not equal value |
| Greater Than     | `--var > number`  | Variable greater than number  |
| Less Than        | `--var < number`  | Variable less than number     |
| Greater or Equal | `--var >= number` | Variable greater or equal     |
| Less or Equal    | `--var <= number` | Variable less or equal        |
| AND              | `--a and --b`     | Both conditions true          |
| OR               | `--a or --b`      | Either condition true         |
| NOT              | `not --var`       | Condition is false            |

**Examples:**

```css
if(--user: var(--user); else: { "error": "Not found" })
if(--role = admin: "granted"; else: "denied")
if(--age >= 18: "adult"; else: "minor")
if(--a and --b: "both"; else: "not both")
```

### FR-07: Response Types

The system SHALL support JSON and HTML response types.

**JSON Response:**

```css
@return json({ "key": "value" })
@return json(var(--data))
@return json([])
```

**HTML Response:**

```css
@return html('<h1>Hello</h1>') @return html(var(--htmlContent));
```

### FR-08: Status Codes

The system SHALL support setting HTTP status codes.

**Literal Status:**

```css
status: 404;
```

**Conditional Status:**

```css
status: if(--authorized: 200; else: 403);
```

### FR-09: CLI Interface

The system SHALL provide a command-line interface.

**Usage:**

```bash
css-server <file> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --port <number>` | Override server port |
| `-h, --host <string>` | Override server host |
| `-v, --version` | Display version |
| `--help` | Display help |

---

## Non-Functional Requirements

### NFR-01: Performance

- SHALL parse CSS files in under 100ms for typical API definitions
- SHALL execute SQL queries using prepared statements
- SHALL reuse database connection across requests

### NFR-02: Error Handling

- SHALL report parse errors with line numbers
- SHALL return 404 for unmatched routes
- SHALL handle missing database gracefully
- SHALL return JSON error objects for SQL failures

### NFR-03: Security

- SHALL use parameterized queries to prevent SQL injection
- SHALL NOT expose internal error details to clients
- SHALL validate route paths

---

## Limitations

### Current Limitations

1. **No middleware support** - Cannot define custom middleware
2. **No authentication** - Must be handled externally
3. **SQLite only** - No support for other databases
4. **No file uploads** - Request body parsing limited to JSON/form
5. **No CORS** - Must be handled via proxy
6. **No rate limiting** - Must be handled externally

### Future Considerations

1. Middleware hooks
2. Multiple database support
3. WebSocket support
4. Server-side events
5. Request validation
6. Response caching
