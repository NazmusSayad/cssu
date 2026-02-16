# CSS Syntax Reference

This document describes the complete CSS syntax supported by css-server.

## Table of Contents

- [Server Configuration](#server-configuration)
- [Database Schema](#database-schema)
- [Routes](#routes)
- [Variables](#variables)
- [Functions](#functions)
- [Conditionals](#conditionals)
- [Responses](#responses)
- [Status Codes](#status-codes)
- [Complete Example](#complete-example)

---

## Server Configuration

Define server settings using the `@server` at-rule.

### Syntax

```css
@server {
  port: <number>;
  database: <string>;
  host: <string>;
}
```

### Properties

| Property   | Type   | Default   | Description               |
| ---------- | ------ | --------- | ------------------------- |
| `port`     | number | 3000      | Server port               |
| `database` | string | -         | SQLite database file path |
| `host`     | string | localhost | Server host binding       |

### Environment Variables

Use `env()` to read environment variables with fallback values:

```css
@server {
  port: env(PORT, 3000);
  database: env(DATABASE_PATH, ./app.db);
  host: env(HOST, localhost);
}
```

---

## Database Schema

Define a schema with a single `@database` block. Statements are separated by semicolons.

```css
@database {
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT
  );
  CREATE INDEX users_email ON users(email);
}
```

The `@database` block is optional. If omitted, database features are unavailable unless a database is configured another way.

---

## Routes

Define HTTP routes using CSS selectors.

### Syntax

```css
[path='<route-path>']:http_method {
  /* route body */
}
```

### HTTP Methods

| Method  | Pseudo-class |
| ------- | ------------ |
| GET     | `:GET`       |
| POST    | `:POST`      |
| PUT     | `:PUT`       |
| PATCH   | `:PATCH`     |
| DELETE  | `:DELETE`    |
| HEAD    | `:HEAD`      |
| OPTIONS | `:OPTIONS`   |

### Path Patterns

| Pattern                       | Description          | Example                                    |
| ----------------------------- | -------------------- | ------------------------------------------ |
| `/`                           | Root path            | `[path="/"]:GET`                           |
| `/users`                      | Static path          | `[path="/users"]:GET`                      |
| `/users/:id`                  | Path with parameter  | `[path="/users/:id"]:GET`                  |
| `/posts/:postId/comments/:id` | Multiple parameters  | `[path="/posts/:postId/comments/:id"]:GET` |
| `*`                           | Catch-all / fallback | `[path="*"]:GET`                           |

### Examples

```css
[path="/"]:GET {
  @return html("<h1>Home</h1>");
}

[path="/users"]:GET {
  @return json(sql("SELECT * FROM users"));
}

[path="/users"]:POST {
  --name: body(name);
  @return json(sql("INSERT INTO users (name) VALUES (?)", var(--name)));
}

[path="/users/:id"]:GET {
  --id: param(:id);
  @return json(sql("SELECT * FROM users WHERE id = ?", var(--id)));
}

[path="*"]:GET {
  status: 404;
  @return json({ "error": "Not found" });
}
```

---

## Variables

Define variables using CSS custom properties (prefixed with `--`).

### Syntax

```css
--variable-name: <expression>;
```

### Usage

Reference variables with `var()`:

```css
--id: param(: id);
--user: sql('SELECT * FROM users WHERE id = ?', var(--id));
@return json(var(--user));
```

---

## Functions

### param()

Extract route parameters.

```css
param(:parameter-name)
```

**Example:**

```css
[path='/users/:id']:get {
  --id: param(: id);
}
```

### query()

Extract query string parameters.

```css
query(parameter-name)
```

**Example:**

```css
[path='/search']:get {
  --q: query(q);
  --page: query(page);
}
```

**Request:** `GET /search?q=hello&page=2`

### body()

Extract fields from request body (JSON or form data).

```css
body(field-name)
```

**Example:**

```css
[path='/users']:post {
  --name: body(name);
  --email: body(email);
}
```

**Request body:**

```json
{
  "name": "John",
  "email": "john@example.com"
}
```

### header()

Extract HTTP headers.

```css
header(header-name)
```

**Example:**

```css
[path='/admin']:get {
  --role: header(x-user-role);
  --auth: header(authorization);
}
```

**Note:** Header names are case-insensitive.

### var()

Reference a previously defined variable.

```css
var(--variable-name)
```

**Example:**

```css
--id: param(: id);
--user: sql('SELECT * FROM users WHERE id = ?', var(--id));
```

### sql()

Execute SQLite queries with parameterized arguments.

```css
sql("query", arg1, arg2, ...)
```

**Examples:**

```css
/* SELECT all rows */
sql("SELECT * FROM users")

/* SELECT with parameters */
sql("SELECT * FROM users WHERE id = ?", var(--id))

/* INSERT */
sql("INSERT INTO users (name, email) VALUES (?, ?)", var(--name), var(--email))

/* UPDATE */
sql("UPDATE users SET name = ? WHERE id = ?", var(--name), var(--id))

/* DELETE */
sql("DELETE FROM users WHERE id = ?", var(--id))
```

**Return Values:**

| Query Type         | Return Value                      |
| ------------------ | --------------------------------- |
| SELECT (no args)   | Array of row objects              |
| SELECT (with args) | Single row object (`.get()`)      |
| INSERT             | `{ id: number, changes: number }` |
| UPDATE             | `{ changes: number }`             |
| DELETE             | `{ changes: number }`             |
| Error              | `{ error: string }`               |

---

## Conditionals

Use `if()` for conditional logic.

### Syntax

```css
if(
  condition: value;
  condition: value;
  else: default-value;
)
```

### Condition Types

| Type             | Syntax            | Description                                     |
| ---------------- | ----------------- | ----------------------------------------------- |
| Truthy           | `--var`           | Variable is truthy (not null, not empty, not 0) |
| Equals           | `--var = value`   | Variable equals value                           |
| Not Equals       | `--var != value`  | Variable does not equal value                   |
| Greater Than     | `--var > number`  | Variable is greater than number                 |
| Less Than        | `--var < number`  | Variable is less than number                    |
| Greater or Equal | `--var >= number` | Variable is greater or equal                    |
| Less or Equal    | `--var <= number` | Variable is less or equal                       |

### Logical Operators

Combine conditions with logical operators:

| Operator | Syntax        | Description                   |
| -------- | ------------- | ----------------------------- |
| AND      | `--a and --b` | Both conditions must be true  |
| OR       | `--a or --b`  | Either condition must be true |
| NOT      | `not --var`   | Negate a condition            |

### Truthy Values

| Type      | Truthy    | Falsy       |
| --------- | --------- | ----------- |
| null      | -         | `null`      |
| undefined | -         | `undefined` |
| Boolean   | `true`    | `false`     |
| Number    | non-zero  | `0`         |
| String    | non-empty | `""`        |
| Array     | non-empty | `[]`        |
| Object    | non-empty | `{}`        |

### Examples

**Truthy check:**

```css
@return json(if(--user: var(--user); else: { "error": "Not found" }));
```

**Equality:**

```css
@return json(if(--role = admin: "granted"; else: "denied"));
```

**Comparison:**

```css
@return json(if(
  --age >= 18: "adult";
  --age >= 13: "teen";
  else: "child";
));
```

**Logical AND:**

```css
@return json(if(--admin and --active: "dashboard"; else: "login"));
```

**Logical OR:**

```css
@return json(if(--editor or --admin: "edit"; else: "view"));
```

**Logical NOT:**

```css
@return json(if(not --banned: "welcome"; else: "blocked"));
```

---

## Responses

Use `@return` to send responses.

### JSON Response

```css
@return json(<expression>);
```

**Examples:**

```css
@return json({ "message": "Hello" })
@return json(var(--users))
@return json([])
@return json(sql("SELECT * FROM users"))
@return json(if(--user: var(--user); else: { "error": "Not found" }))
```

### HTML Response

```css
@return html(<expression>);
```

**Examples:**

```css
@return html('<h1>Hello World</h1>') @return html(var(--htmlContent));
```

---

## Status Codes

Set HTTP status codes with the `status` property.

### Literal Status

```css
status: <number>;
```

**Example:**

```css
[path="*"]:GET {
  status: 404;
  @return json({ "error": "Not found" });
}
```

### Conditional Status

```css
status: if(<condition>: <number>; else: <number>);
```

**Example:**

```css
[path="/admin"]:GET {
  --role: header(x-user-role);
  status: if(--role = admin: 200; else: 403);
  @return json(if(--role = admin: { "message": "Welcome" }; else: { "error": "Access denied" }));
}
```

---

## Complete Example

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

/* Home page */
[path="/"]:GET {
  @return html("<h1>Welcome to CSS Server</h1>");
}

/* List all users */
[path="/users"]:GET {
  @return json(sql("SELECT * FROM users"));
}

/* Get user by ID */
[path="/users/:id"]:GET {
  --id: param(:id);
  --user: sql("SELECT * FROM users WHERE id = ?", var(--id));
  @return json(if(--user: var(--user); else: { "error": "User not found" }));
}

/* Create user */
[path="/users"]:POST {
  --name: body(name);
  --email: body(email);
  @return json(sql("INSERT INTO users (name, email) VALUES (?, ?)", var(--name), var(--email)));
}

/* Update user */
[path="/users/:id"]:PUT {
  --id: param(:id);
  --name: body(name);
  --email: body(email);
  @return json(sql("UPDATE users SET name = ?, email = ? WHERE id = ?", var(--name), var(--email), var(--id)));
}

/* Delete user */
[path="/users/:id"]:DELETE {
  --id: param(:id);
  @return json(sql("DELETE FROM users WHERE id = ?", var(--id)));
}

/* Search users */
[path="/search"]:GET {
  --q: query(q);
  --results: sql("SELECT * FROM users WHERE name LIKE ?", var(--q));
  @return json(if(--q: var(--results); else: []));
}

/* Admin check */
[path="/admin"]:GET {
  --role: header(x-user-role);
  status: if(--role = admin: 200; else: 403);
  @return json(if(
    --role = admin: { "message": "Welcome, admin!" };
    else: { "error": "Access denied" };
  ));
}

/* Age verification */
[path="/check-age"]:GET {
  --age: query(age);
  @return json(if(
    --age >= 18: { "status": "adult" };
    --age >= 13: { "status": "teen" };
    else: { "status": "child" };
  ));
}

/* Catch-all / 404 */
[path="*"]:GET {
  status: 404;
  @return json({ "error": "Not found" });
}
```

---

## Quick Reference

| Feature       | Syntax                       |
| ------------- | ---------------------------- |
| Server config | `@server { ... }`            |
| Route         | `[path="/path"]:GET { ... }` |
| Variable      | `--name: value;`             |
| Param         | `param(:name)`               |
| Query         | `query(name)`                |
| Body          | `body(name)`                 |
| Header        | `header(name)`               |
| Variable ref  | `var(--name)`                |
| SQL           | `sql("query", args...)`      |
| If            | `if(cond: val; else: val)`   |
| Return JSON   | `@return json(...)`          |
| Return HTML   | `@return html(...)`          |
| Status        | `status: 404;`               |
| Equals        | `--var = value`              |
| Not equals    | `--var != value`             |
| Greater than  | `--var > number`             |
| Less than     | `--var < number`             |
| AND           | `--a and --b`                |
| OR            | `--a or --b`                 |
| NOT           | `not --var`                  |
