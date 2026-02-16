# CSS Server - AI Agent Instructions

This is a CSS-based backend framework that compiles CSS syntax into an Express.js server.

## Project Overview

CSS Server allows developers to write server logic (HTTP routing, SQL queries, conditionals) using CSS syntax. The system parses CSS files with PostCSS and compiles them into a working Express.js server with SQLite database support.

**Read these docs first:**

- `docs/ARCHITECTURE.md` - System design and data flow
- `docs/REQUIREMENTS.md` - Functional requirements
- `docs/SYNTAX.md` - Complete CSS syntax reference

## Development Commands

```bash
pnpm build          # Compile TypeScript to dist/
pnpm test           # Run all tests with vitest
pnpm start -- ./examples/crud.css  # Run server with CSS file
```

## Key Technical Decisions

1. **PostCSS** for CSS parsing (not Puppeteer)
2. **pnpm** as package manager (not npm)
3. **better-sqlite3** for SQLite (synchronous API)
4. **Express.js** as the HTTP server runtime

## CSS Syntax Conventions

### Route Definition

```css
[path='/users/:id']:get {
}
```

- Use `[path="..."]` selector for routes
- Use `:GET`, `:POST`, `:PUT`, `:DELETE` pseudo-classes for HTTP methods
- URL parameters use Express syntax: `:id`, `:name`, etc.

### Variable Assignment

```css
--varName: value;
```

- Variables use `--` prefix (CSS custom property style)
- Reference with `var(--varName)`

### Built-in Functions

- `param(:name)` - URL parameter
- `query(name)` - Query string parameter
- `body()` - Request body (JSON)
- `header(name)` - Request header
- `sql("query", args...)` - SQL query execution
- `var(--name)` - Variable reference
- `if(--var: value; else: default)` - Conditional expression

### Database Schema

```css
@database {
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT
  );
}
```

### Return Statement

```css
@return json(...);
@return html(...);
```

## Code Style

- No comments unless explicitly instructed
- Full TypeScript type inference (no explicit generics when inferable)
- Minimal, direct implementations
- No `any` types

## Testing

- Tests use vitest framework
- Integration tests use supertest for HTTP requests
- Each test file creates isolated SQLite databases to avoid conflicts
- Run tests after making changes: `pnpm test`

## Windows-Specific Notes

- `better-sqlite3` may need rebuild: `pnpm rebuild better-sqlite3`
- Use unique database filenames for parallel tests

## File Structure

```
src/
├── types.ts      # All TypeScript interfaces
├── parser.ts     # PostCSS parsing → AST
├── evaluator.ts  # Expression evaluation
├── compiler.ts   # AST → Express handlers
├── runtime.ts    # Server creation/startup
└── index.ts      # CLI entry point

tests/
├── parser.test.ts
├── evaluator.test.ts
└── integration.test.ts
```

## When Adding Features

1. Update `types.ts` if new interfaces needed
2. Update `parser.ts` if new CSS syntax
3. Update `evaluator.ts` if new expressions
4. Update `compiler.ts` if new route handling
5. Add tests for new functionality
6. Update `docs/SYNTAX.md` if syntax changes
