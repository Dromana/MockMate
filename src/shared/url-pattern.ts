const cache = new Map<string, RegExp>()

export function compilePattern(pattern: string, type: 'glob' | 'regex' | 'exact'): RegExp {
  const cacheKey = `${type}:${pattern}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  let regex: RegExp

  if (type === 'exact') {
    regex = new RegExp(`^${escapeRegex(pattern)}$`)
  } else if (type === 'regex') {
    regex = new RegExp(pattern)
  } else {
    // glob: escape regex metacharacters except * and ?
    const globPattern = pattern
      .split('**')
      .map((part) =>
        part
          .split('*')
          .map((segment) => escapeRegex(segment).replace(/\?/g, '.'))
          .join('[^/]*'),
      )
      .join('.*')
    regex = new RegExp(globPattern)
  }

  cache.set(cacheKey, regex)
  return regex
}

export function matchesPattern(url: string, pattern: string, type: 'glob' | 'regex' | 'exact'): boolean {
  try {
    return compilePattern(pattern, type).test(url)
  } catch {
    return false
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.+^${}()|[\]\\]/g, '\\$&')
}
