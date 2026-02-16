import postcss, { AtRule, Root } from 'postcss'
import {
  Condition,
  Expression,
  HttpMethod,
  IfBranch,
  ParsedCSS,
  RouteRule,
  ServerConfig,
  VariableAssignment,
} from './types.js'

const _HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]

export function parseCSS(css: string): ParsedCSS {
  const extracted = extractDatabaseSchema(css)
  const root = postcss.parse(extracted.cleaned)

  const config = parseServerConfig(root)
  const routes = parseRoutes(root)

  return { config, routes, schema: extracted.schema }
}

function extractDatabaseSchema(css: string): {
  schema?: string
  cleaned: string
} {
  let schema: string | undefined
  let cleaned = css
  let index = cleaned.indexOf('@database')

  while (index !== -1) {
    const startBrace = cleaned.indexOf('{', index)
    if (startBrace === -1) break

    let depth = 0
    let endBrace = -1
    for (let i = startBrace; i < cleaned.length; i++) {
      const char = cleaned[i]
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      if (depth === 0) {
        endBrace = i
        break
      }
    }

    if (endBrace === -1) break

    if (!schema) {
      schema = cleaned.slice(startBrace + 1, endBrace).trim()
    }

    cleaned = cleaned.slice(0, index) + cleaned.slice(endBrace + 1)
    index = cleaned.indexOf('@database')
  }

  return { schema: schema || undefined, cleaned }
}

function parseServerConfig(root: Root): ServerConfig {
  const config: ServerConfig = { port: 3000 }

  root.walkAtRules('server', (atRule) => {
    atRule.walkDecls((decl) => {
      switch (decl.prop) {
        case 'port':
          config.port = parseEnvOrNumber(decl.value, 3000)
          break
        case 'database':
          config.database = parseEnvOrString(decl.value)
          break
        case 'host':
          config.host = parseEnvOrString(decl.value)
          break
      }
    })
  })

  return config
}

function parseEnvOrNumber(value: string, fallback: number): number {
  const envMatch = value.match(/^env\s*\(\s*([^,)]+)(?:\s*,\s*(.+))?\s*\)$/)
  if (envMatch) {
    const envVar = process.env[envMatch[1].trim()]
    if (envVar) return parseInt(envVar, 10)
    if (envMatch[2]) return parseInt(envMatch[2].trim(), 10)
    return fallback
  }
  return parseInt(value, 10) || fallback
}

function parseEnvOrString(value: string): string {
  const envMatch = value.match(/^env\s*\(\s*([^,)]+)(?:\s*,\s*(.+))?\s*\)$/)
  if (envMatch) {
    const envVar = process.env[envMatch[1].trim()]
    if (envVar) return envVar
    if (envMatch[2]) return envMatch[2].trim().replace(/^["']|["']$/g, '')
    return ''
  }
  return value.trim().replace(/^["']|["']$/g, '')
}

function parseRoutes(root: Root): RouteRule[] {
  const routes: RouteRule[] = []

  root.walkRules((rule) => {
    const { path, method } = parseSelector(rule.selector)
    if (!path || !method) return

    const variables: VariableAssignment[] = []
    let status: RouteRule['status'] | undefined
    let returnValue: RouteRule['return'] | undefined

    rule.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) {
        variables.push({
          name: decl.prop.slice(2),
          value: parseExpression(decl.value),
        })
      } else if (decl.prop === 'status') {
        const parsed = parseExpression(decl.value)
        if (parsed.type === 'literal') {
          status = { type: 'literal', value: parsed.value as number }
        } else if (parsed.type === 'var') {
          status = { type: 'var', value: parsed }
        } else if (parsed.type === 'if') {
          status = { type: 'if', value: parsed }
        }
      }
    })

    rule.walkAtRules('return', (atRule) => {
      returnValue = parseReturnAtRule(atRule)
    })

    if (returnValue) {
      routes.push({ path, method, variables, status, return: returnValue })
    }
  })

  return routes
}

function parseSelector(selector: string): {
  path: string | null
  method: HttpMethod | null
} {
  const pathMatch = selector.match(/\[path\s*=\s*["']([^"']+)["']\s*\]/)
  const methodMatch = selector.match(
    /:(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/
  )

  return {
    path: pathMatch ? pathMatch[1] : null,
    method: methodMatch ? (methodMatch[1] as HttpMethod) : null,
  }
}

function parseReturnAtRule(atRule: AtRule): {
  type: 'json' | 'html'
  value: Expression
} {
  const params = atRule.params.trim()

  if (params.startsWith('json(')) {
    const inner = extractFunctionContent(params, 'json')
    return {
      type: 'json',
      value: parseExpression(inner),
    }
  }

  if (params.startsWith('html(')) {
    const inner = extractFunctionContent(params, 'html')
    return {
      type: 'html',
      value: parseExpression(inner),
    }
  }

  return {
    type: 'json',
    value: parseExpression(params),
  }
}

function parseExpression(value: string): Expression {
  const trimmedValue = value.trim()

  if (trimmedValue.startsWith('sql(')) {
    return parseSqlExpression(trimmedValue)
  }

  if (trimmedValue.startsWith('param(')) {
    const inner = extractFunctionContent(trimmedValue, 'param')
    return { type: 'param', paramName: inner.replace(/^:/, '') }
  }

  if (trimmedValue.startsWith('query(')) {
    const inner = extractFunctionContent(trimmedValue, 'query')
    return { type: 'query', paramName: inner }
  }

  if (trimmedValue.startsWith('body(')) {
    const inner = extractFunctionContent(trimmedValue, 'body')
    return { type: 'body', fieldName: inner }
  }

  if (trimmedValue.startsWith('header(')) {
    const inner = extractFunctionContent(trimmedValue, 'header')
    return { type: 'header', headerName: inner }
  }

  if (trimmedValue.startsWith('var(')) {
    const inner = extractFunctionContent(trimmedValue, 'var')
    return { type: 'var', name: inner.replace(/^--/, '') }
  }

  if (trimmedValue.startsWith('if(')) {
    return parseIfExpression(trimmedValue)
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
    return { type: 'literal', value: parseFloat(trimmedValue) }
  }

  if (trimmedValue === 'true' || trimmedValue === 'false') {
    return { type: 'literal', value: trimmedValue === 'true' }
  }

  if (trimmedValue === 'null') {
    return { type: 'literal', value: null }
  }

  if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
    try {
      return { type: 'json', value: JSON.parse(trimmedValue) }
    } catch {
      return { type: 'literal', value: parseStringValue(trimmedValue) }
    }
  }

  return { type: 'literal', value: parseStringValue(trimmedValue) }
}

function parseSqlExpression(value: string): Expression {
  const match = value.match(/^sql\s*\(\s*["'](.+?)["']\s*(?:,\s*(.+))?\s*\)$/s)
  if (!match) {
    return { type: 'sql', query: '', args: [] }
  }

  const query = match[1]
  const argsStr = match[2] || ''

  const args = parseFunctionArgs(argsStr)

  return { type: 'sql', query, args }
}

function parseFunctionArgs(argsStr: string): Expression[] {
  if (!argsStr.trim()) return []

  const args: Expression[] = []
  let current = ''
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i]

    if ((char === '"' || char === "'") && !inString) {
      inString = true
      stringChar = char
    } else if (char === stringChar && inString) {
      inString = false
    } else if (!inString) {
      if (char === '(') depth++
      else if (char === ')') depth--
      else if (char === ',' && depth === 0) {
        if (current.trim()) {
          args.push(parseExpression(current.trim()))
        }
        current = ''
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    args.push(parseExpression(current.trim()))
  }

  return args
}

function parseIfExpression(value: string): Expression {
  const inner = extractFunctionContent(value, 'if')
  const branches: IfBranch[] = []
  let elseValue: Expression | undefined

  const parts = splitIfBranches(inner)

  for (const part of parts) {
    if (part.trim().startsWith('else:')) {
      const elseContent = part.trim().slice(5).trim()
      elseValue = parseExpression(elseContent)
    } else {
      const colonIndex = findColonInBranch(part)
      if (colonIndex !== -1) {
        const conditionStr = part.slice(0, colonIndex).trim()
        const valueStr = part.slice(colonIndex + 1).trim()

        const condition = parseCondition(conditionStr)
        branches.push({ condition, value: parseExpression(valueStr) })
      }
    }
  }

  return { type: 'if', branches, elseValue }
}

function splitIfBranches(str: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if ((char === '"' || char === "'") && !inString) {
      inString = true
      stringChar = char
    } else if (char === stringChar && inString) {
      inString = false
    } else if (!inString) {
      if (char === '(') depth++
      else if (char === ')') depth--
      else if (char === ';' && depth === 0) {
        parts.push(current)
        current = ''
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    parts.push(current)
  }

  return parts
}

function findColonInBranch(str: string): number {
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if ((char === '"' || char === "'") && !inString) {
      inString = true
      stringChar = char
    } else if (char === stringChar && inString) {
      inString = false
    } else if (!inString) {
      if (char === '(') depth++
      else if (char === ')') depth--
      else if (char === ':' && depth === 0) {
        return i
      }
    }
  }

  return -1
}

function parseCondition(str: string): Condition {
  const trimmedStr = str.trim()

  const orIndex = trimmedStr.indexOf(' or ')
  const andIndex = trimmedStr.indexOf(' and ')

  if (orIndex !== -1) {
    const left = trimmedStr.slice(0, orIndex).trim()
    const right = trimmedStr.slice(orIndex + 4).trim()
    return {
      type: 'or',
      conditions: [parseCondition(left), parseCondition(right)],
    }
  }

  if (andIndex !== -1) {
    const left = trimmedStr.slice(0, andIndex).trim()
    const right = trimmedStr.slice(andIndex + 5).trim()
    return {
      type: 'and',
      conditions: [parseCondition(left), parseCondition(right)],
    }
  }

  if (trimmedStr.startsWith('not ')) {
    return { type: 'not', condition: parseCondition(trimmedStr.slice(4)) }
  }

  const compMatch = trimmedStr.match(/^(--[\w-]+)\s*(=|!=|>=|<=|>|<)\s*(.+)$/)
  if (compMatch) {
    const varName = compMatch[1].replace(/^--/, '')
    const op = compMatch[2]
    const valueStr = compMatch[3].trim()
    const value = isNaN(Number(valueStr))
      ? parseStringValue(valueStr)
      : Number(valueStr)

    switch (op) {
      case '=':
        return { type: 'equals', varName, value: value as string | number }
      case '!=':
        return { type: 'notEquals', varName, value: value as string | number }
      case '>':
        return { type: 'greaterThan', varName, value: value as number }
      case '<':
        return { type: 'lessThan', varName, value: value as number }
      case '>=':
        return { type: 'greaterOrEqual', varName, value: value as number }
      case '<=':
        return { type: 'lessOrEqual', varName, value: value as number }
    }
  }

  const varMatch = trimmedStr.match(/^--([\w-]+)$/)
  if (varMatch) {
    return { type: 'truthy', varName: varMatch[1] }
  }

  return { type: 'truthy', varName: trimmedStr.replace(/^--/, '') }
}

function extractFunctionContent(value: string, funcName: string): string {
  const start = value.indexOf(funcName + '(') + funcName.length + 1
  let depth = 1
  let end = start

  for (let i = start; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }

  return value.slice(start, end)
}

function parseStringValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '')
}
