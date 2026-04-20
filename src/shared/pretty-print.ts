/**
 * Pretty-prints response body based on detected format.
 * Returns the formatted string, or the original if formatting fails.
 */
export function prettyPrint(body: string, format: 'json' | 'html' | 'js' | 'css' | 'graphql' | 'unknown'): string {
  try {
    switch (format) {
      case 'json':    return prettyJSON(body)
      case 'html':    return prettyHTML(body)
      case 'js':      return prettyJS(body)
      case 'css':     return prettyCSS(body)
      case 'graphql': return prettyGraphQL(body)
      default:        return body
    }
  } catch {
    return body
  }
}

export function detectFormat(
  resourceType: string,
  contentType: string | null | undefined,
): 'json' | 'html' | 'js' | 'css' | 'unknown' {
  const ct = (contentType ?? '').toLowerCase()
  if (resourceType === 'graphql') return 'json'
  if (ct.includes('json'))        return 'json'
  if (ct.includes('html'))        return 'html'
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'js'
  if (ct.includes('css'))         return 'css'
  // fallback by resourceType
  if (resourceType === 'fetch')      return 'json'
  if (resourceType === 'document')   return 'html'
  if (resourceType === 'script')     return 'js'
  if (resourceType === 'stylesheet') return 'css'
  return 'unknown'
}

// ─── formatters ──────────────────────────────────────────────────────────────

function prettyGraphQL(text: string): string {
  const parsed = JSON.parse(text) as {
    query?: string
    operationName?: string
    variables?: unknown
  }

  const sections: string[] = []

  if (parsed.operationName) {
    sections.push(`# Operation: ${parsed.operationName}`)
  }

  if (parsed.query) {
    // JSON.parse already unescapes \n → real newlines, trim extra blank lines
    const query = parsed.query.replace(/\n{3,}/g, '\n\n').trim()
    sections.push(query)
  }

  if (parsed.variables !== undefined && parsed.variables !== null) {
    sections.push('# Variables\n' + JSON.stringify(parsed.variables, null, 2))
  }

  return sections.join('\n\n')
}

function prettyJSON(text: string): string {
  return JSON.stringify(JSON.parse(text), null, 2)
}

function prettyHTML(html: string): string {
  // Normalise whitespace between tags, then indent
  const normalised = html
    .replace(/>\s+</g, '>\n<')
    .replace(/^\s+|\s+$/g, '')
  const lines = normalised.split('\n')
  let indent = 0
  const result: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const isClosing  = /^<\//.test(line)
    const isSelfClose = /\/>$/.test(line) || /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)[\s>]/i.test(line)
    const isDoctype  = /^<!/.test(line)
    const isComment  = /^<!--/.test(line)

    if (isClosing) indent = Math.max(0, indent - 1)

    result.push('  '.repeat(indent) + line)

    if (!isClosing && !isSelfClose && !isDoctype && !isComment && /^<[a-zA-Z]/.test(line)) {
      indent++
    }
  }

  return result.join('\n')
}

function prettyJS(js: string): string {
  // Lightweight formatter: normalise braces, semicolons, and indentation.
  // Not a full AST formatter — handles minified code reasonably well.
  let result = ''
  let depth = 0
  let i = 0
  let inString: string | null = null

  const pad = () => '  '.repeat(depth)

  while (i < js.length) {
    const ch = js[i]

    // Track string literals so we don't misformat their content
    if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
      inString = ch
      result += ch
      i++
      continue
    }
    if (inString) {
      if (ch === '\\') { result += ch + (js[i + 1] ?? ''); i += 2; continue }
      if (ch === inString) inString = null
      result += ch
      i++
      continue
    }

    if (ch === '{' || ch === '[') {
      result += ch + '\n' + pad() + '  '
      depth++
      i++
      continue
    }
    if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1)
      result = result.trimEnd() + '\n' + pad() + ch
      i++
      continue
    }
    if (ch === ';') {
      result += ';\n' + pad()
      i++
      continue
    }
    if (ch === ',') {
      result += ',\n' + pad()
      i++
      continue
    }
    result += ch
    i++
  }

  return result.trim()
}

function prettyCSS(css: string): string {
  return css
    .replace(/\s*\{\s*/g, ' {\n  ')
    .replace(/;\s*/g, ';\n  ')
    .replace(/\s*\}\s*/g, '\n}\n')
    .replace(/,\s*/g, ',\n')
    .trim()
}
