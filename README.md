# butcss

A PostCSS-based backend framework that lets you write server logic in CSS syntax.

## Overview

css-server parses CSS files with custom syntax and compiles them into an Express.js server. It supports:

- HTTP routing via CSS selectors (`[path="/users"]:GET`)
- SQLite database queries via `sql()` function
- Request data extraction (params, query, body, headers)
- Conditional logic via `if()` expressions
- Dynamic status codes and responses

## Installation

```bash
pnpm install
pnpm build
```

## Quick Start

```bash
node dist/cli.js ./examples/crud.css
```

Examples live in `./examples/`.

## Example

```css
@server {
  port: env(PORT, 3000);
  database: env(DATABASE, ./app.db);
}

@database {
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT
  );
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
```

## CLI

```text
Usage: css-server <file>
```

## Running Tests

```bash
pnpm test
```

## License

MIT
