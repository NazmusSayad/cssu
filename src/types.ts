export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'

export type JsonPrimitive = string | number | boolean | null

export interface JsonObject {
  [key: string]: JsonPrimitive | JsonObject | JsonArray
}

export type JsonArray = Array<JsonPrimitive | JsonObject | JsonArray>

export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export interface ServerConfig {
  port: number
  database?: string
  host?: string
}

export interface RouteRule {
  path: string
  method: HttpMethod
  variables: VariableAssignment[]
  status?: StatusValue
  return: ReturnValue
}

export interface VariableAssignment {
  name: string
  value: Expression
}

export type Expression =
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'var'; name: string }
  | { type: 'param'; paramName: string }
  | { type: 'query'; paramName: string }
  | { type: 'body'; fieldName: string }
  | { type: 'header'; headerName: string }
  | { type: 'sql'; query: string; args: Expression[] }
  | { type: 'if'; branches: IfBranch[]; elseValue?: Expression }
  | { type: 'json'; value: JsonValue }
  | { type: 'html'; value: string }
  | { type: 'concat'; parts: Expression[] }

export interface IfBranch {
  condition: Condition
  value: Expression
}

export type Condition =
  | { type: 'truthy'; varName: string }
  | { type: 'equals'; varName: string; value: string | number }
  | { type: 'notEquals'; varName: string; value: string | number }
  | { type: 'greaterThan'; varName: string; value: number }
  | { type: 'lessThan'; varName: string; value: number }
  | { type: 'greaterOrEqual'; varName: string; value: number }
  | { type: 'lessOrEqual'; varName: string; value: number }
  | { type: 'and'; conditions: Condition[] }
  | { type: 'or'; conditions: Condition[] }
  | { type: 'not'; condition: Condition }

export type StatusValue =
  | { type: 'literal'; value: number }
  | { type: 'var'; value: Expression }
  | { type: 'if'; value: Expression }

export interface ReturnValue {
  type: 'json' | 'html'
  value: Expression
}

export interface ParsedCSS {
  config: ServerConfig
  routes: RouteRule[]
  schema?: string
}

export interface RequestContext {
  params: Record<string, string>
  query: Record<string, string>
  body: Record<string, unknown>
  headers: Record<string, string>
  variables: Record<string, unknown>
}
