# Architecture

## System Overview

css-server is a transpiler that converts CSS syntax into a running Express.js server. The architecture follows a pipeline pattern:

```
CSS File → Parser → AST → Compiler → Express Routes → Runtime
```

## Components

### 1. CLI (`index.ts`)

Entry point that:

- Parses command-line arguments using Commander
- Reads the CSS file from disk
- Invokes the parser and runtime

```
┌─────────────┐
│  CLI Input  │
│  (file.css) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Parser    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Runtime   │
│  (Express)  │
└─────────────┘
```

### 2. Parser (`parser.ts`)

Uses PostCSS to parse CSS into an Abstract Syntax Tree (AST):

**Input:** CSS string
**Output:** `ParsedCSS` object

```typescript
interface ParsedCSS {
  config: ServerConfig // port, database, host
  routes: RouteRule[] // parsed routes
}
```

**Parsing Steps:**

1. **Server Config Extraction**
   - Finds `@server` at-rule
   - Parses `port`, `database`, `host` properties
   - Resolves `env()` function for environment variables

2. **Route Extraction**
   - Finds rules matching `[path="..."]:METHOD` pattern
   - Extracts path and HTTP method from selector

3. **Declaration Parsing**
   - Variable assignments (`--name: ...`)
   - Status code (`status: ...`)
   - Return statement (`@return ...`)

4. **Expression Parsing**
   - `sql(query, args...)` → SQL expression
   - `param(:name)` → Route parameter extraction
   - `query(name)` → Query string extraction
   - `body(name)` → Request body extraction
   - `header(name)` → Header extraction
   - `var(--name)` → Variable reference
   - `if(condition: value; else: default)` → Conditional

### 3. Evaluator (`evaluator.ts`)

Runtime expression evaluator that executes during request handling:

**Key Functions:**

| Function               | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `evaluateExpression()` | Main dispatcher for all expression types             |
| `evaluateSql()`        | Executes SQLite queries with prepared statements     |
| `evaluateIf()`         | Evaluates conditional expressions                    |
| `evaluateCondition()`  | Evaluates truthy, comparison, and logical conditions |

**Request Context:**

```typescript
interface RequestContext {
  params: Record<string, string> // Route parameters
  query: Record<string, string> // Query string
  body: Record<string, any> // Request body
  headers: Record<string, string> // HTTP headers
  variables: Record<string, any> // Computed variables
}
```

### 4. Compiler (`compiler.ts`)

Transforms parsed routes into Express route handlers:

**Input:** `RouteRule[]`
**Output:** `CompiledRoute[]`

Each compiled route contains:

- `path`: Express path pattern (e.g., `/users/:id`)
- `method`: HTTP method (GET, POST, etc.)
- `handler`: Async function `(req, res) => void`

**Handler Logic:**

```
1. Build RequestContext from req object
2. Evaluate variable assignments in order
3. Evaluate status code (if present)
4. Evaluate return value
5. Send response (json or html)
```

### 5. Runtime (`runtime.ts`)

Creates and starts the Express server:

**Responsibilities:**

- Initialize Express app with middleware (JSON, URL-encoded)
- Initialize SQLite database connection
- Register compiled routes
- Handle 404 fallback
- Start HTTP server

## Data Flow

### Request Flow

```
HTTP Request
    │
    ▼
Express Middleware (body parsing)
    │
    ▼
Route Handler
    │
    ├── Build RequestContext
    │
    ├── Evaluate Variables
    │   │
    │   ├── param() → req.params
    │   ├── query() → req.query
    │   ├── body() → req.body
    │   ├── header() → req.headers
    │   └── sql() → SQLite query
    │
    ├── Evaluate Status
    │
    └── Evaluate Return
        │
        ▼
    HTTP Response
```

### Example Compilation

**CSS Input:**

```css
[path='/users/:id']:get {
  --id: param(: id);
  --user: sql('SELECT * FROM users WHERE id = ?', var(--id));
  @return json(if(--user: var(--user) ; else: {'error': 'Not found'}));
}
```

**Compiled Handler (pseudo-code):**

```javascript
app.get('/users/:id', async (req, res) => {
  const ctx = {
    params: req.params,
    query: req.query,
    body: req.body,
    headers: req.headers,
    variables: {},
  }

  // --id: param(:id)
  ctx.variables.id = ctx.params.id

  // --user: sql(...)
  ctx.variables.user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(ctx.variables.id)

  // @return json(if(...))
  const result = ctx.variables.user
    ? ctx.variables.user
    : { error: 'Not found' }

  res.json(result)
})
```

## File Structure

```
src/
├── types.ts       # TypeScript interfaces
├── parser.ts      # PostCSS parsing logic
├── evaluator.ts   # Expression evaluation
├── compiler.ts    # Route compilation
├── runtime.ts     # Express app creation
└── index.ts       # CLI entry point

tests/
├── parser.test.ts    # Parser unit tests
└── evaluator.test.ts # Evaluator unit tests
```

## Dependencies

| Package          | Purpose               |
| ---------------- | --------------------- |
| `postcss`        | CSS parsing           |
| `express`        | HTTP server framework |
| `better-sqlite3` | SQLite database       |
| `commander`      | CLI argument parsing  |

## Extension Points

### Adding New Functions

1. Add type to `Expression` in `types.ts`
2. Add parsing logic in `parser.ts:parseExpression()`
3. Add evaluation logic in `evaluator.ts:evaluateExpression()`

### Adding New Conditions

1. Add type to `Condition` in `types.ts`
2. Add parsing logic in `parser.ts:parseCondition()`
3. Add evaluation logic in `evaluator.ts:evaluateCondition()`

### Adding New HTTP Methods

1. Add to `HttpMethod` type in `types.ts`
2. Add case in `runtime.ts:registerRoute()`
