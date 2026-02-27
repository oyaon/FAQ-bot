export enum RouteType {
  DIRECT = 'direct',
  LLM_SYNTHESIS = 'llm_synthesis',
  DIRECT_FALLBACK = 'direct_fallback',
  FALLBACK = 'fallback',
  ERROR = 'error',
}

export function isLlmRoute(route: string): boolean {
  return route === RouteType.LLM_SYNTHESIS || route === RouteType.DIRECT_FALLBACK;
}

export function isDirectRoute(route: string): boolean {
  return route === RouteType.DIRECT || route === RouteType.DIRECT_FALLBACK;
}

