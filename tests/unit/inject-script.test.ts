import { describe, it, expect } from 'vitest'
import type { MockRule } from '@/types'

// ─── Inlined helpers from debugger-manager.ts ────────────────────────────────
// These functions are private to that module; we inline them here so tests
// remain independent of the module boundary (same pattern as interceptor-helpers.test.ts).

function escRe(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&')
}

function buildScopeGuard(config: { scheme: string; host: string; path: string }): string {
  if (!config.host) return ''
  const scheme = config.scheme === '*' ? 'https?' : config.scheme
  const hostPart = escRe(config.host).replace(/\*/g, '[^.]+')
  const pathPart =
    !config.path || config.path === '/*'
      ? ''
      : escRe(config.path).replace(/\*/g, '.*')
  const regexStr = `^${scheme}://${hostPart}${pathPart}`
  return `if (!new RegExp(${JSON.stringify(regexStr)}).test(location.href)) return;\n  `
}

function scopeMatchesUrl(
  config: { scheme: string; host: string; path: string },
  url: string,
): boolean {
  if (!config.host) return true
  try {
    const u = new URL(url)
    if (config.scheme !== '*' && u.protocol !== `${config.scheme}:`) return false
    const hostRe = new RegExp(`^${escRe(config.host).replace(/\*/g, '[^.]+')}$`)
    if (!hostRe.test(u.hostname)) return false
    if (config.path && config.path !== '/*') {
      const pathRe = new RegExp(`^${escRe(config.path).replace(/\*/g, '.*')}`)
      if (!pathRe.test(u.pathname)) return false
    }
    return true
  } catch {
    return false
  }
}

function buildBeforeLoadScript(rule: MockRule): string {
  const cfg = rule.injectScript!
  const guard = buildScopeGuard(cfg)
  const safeName = rule.name.replace(/\\/g, '\\\\').replace(/`/g, '\\`')

  if (cfg.codeType === 'css') {
    return `(function () {\n  ${guard}try {\n    var __inject = function() {\n      var __s = document.createElement('style');\n      __s.textContent = ${JSON.stringify(cfg.script)};\n      (document.head || document.documentElement).appendChild(__s);\n    };\n    if (document.head) { __inject(); }\n    else { document.addEventListener('DOMContentLoaded', __inject, { once: true }); }\n  } catch (e) { console.warn('[MockMate inject] \`${safeName}\`:', e); }\n})()`
  }

  return `(function () {\n  ${guard}try {\n    ${cfg.script}\n  } catch (e) { console.warn('[MockMate inject] \`${safeName}\`:', e); }\n})()`
}

function buildTimedScript(rule: MockRule): string {
  const cfg = rule.injectScript!
  const safeName = rule.name.replace(/\\/g, '\\\\').replace(/`/g, '\\`')

  if (cfg.codeType === 'css') {
    return `(function () {\n  try {\n    var __s = document.createElement('style');\n    __s.textContent = ${JSON.stringify(cfg.script)};\n    document.head.appendChild(__s);\n  } catch (e) { console.warn('[MockMate inject] \`${safeName}\`:', e); }\n})()`
  }

  return `(function () {\n  try {\n    ${cfg.script}\n  } catch (e) { console.warn('[MockMate inject] \`${safeName}\`:', e); }\n})()`
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeInjectRule(overrides: Partial<MockRule> = {}): MockRule {
  return {
    id: '1',
    name: 'Test Rule',
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    action: 'inject_script',
    match: { urlPattern: '*', urlPatternType: 'glob', methods: [] },
    response: { statusCode: 200, headers: {}, body: '', bodyType: 'json', delayMs: 0 },
    injectScript: {
      timing: 'dom_ready',
      codeType: 'js',
      script: 'console.log("hello")',
      scheme: '*',
      host: '',
      path: '/*',
    },
    ...overrides,
  }
}

// ─── buildScopeGuard ─────────────────────────────────────────────────────────

describe('buildScopeGuard', () => {
  it('returns empty string when host is empty (match all pages)', () => {
    expect(buildScopeGuard({ scheme: '*', host: '', path: '/*' })).toBe('')
  })

  it('generates a guard that checks location.href', () => {
    const guard = buildScopeGuard({ scheme: '*', host: 'example.com', path: '/*' })
    expect(guard).toContain('location.href')
    expect(guard).toContain('return;')
  })

  it('uses https? for wildcard scheme', () => {
    const guard = buildScopeGuard({ scheme: '*', host: 'example.com', path: '/*' })
    expect(guard).toContain('https?')
  })

  it('uses literal scheme when not wildcard', () => {
    const guard = buildScopeGuard({ scheme: 'https', host: 'example.com', path: '/*' })
    expect(guard).not.toContain('https?')
    expect(guard).toContain('"^https://')
  })

  it('escapes dots in host so they are not treated as regex wildcards', () => {
    const guard = buildScopeGuard({ scheme: '*', host: 'example.com', path: '/*' })
    // Extract the regex string from the guard and verify it treats the dot literally
    const m = guard.match(/new RegExp\((.+?)\)\.test/)
    expect(m).not.toBeNull()
    const re = new RegExp(JSON.parse(m![1]))
    expect(re.test('https://example.com/page')).toBe(true)
    expect(re.test('https://exampleXcom/page')).toBe(false)
  })

  it('converts wildcard host segment to [^.]+ regex', () => {
    const guard = buildScopeGuard({ scheme: '*', host: '*.example.com', path: '/*' })
    expect(guard).toContain('[^.]+')
  })

  it('omits path portion when path is /*', () => {
    const withSlashStar = buildScopeGuard({ scheme: '*', host: 'example.com', path: '/*' })
    const withEmpty = buildScopeGuard({ scheme: '*', host: 'example.com', path: '' })
    expect(withSlashStar).toBe(withEmpty)
  })

  it('includes path in regex when a specific path is set', () => {
    const guard = buildScopeGuard({ scheme: 'https', host: 'example.com', path: '/dashboard*' })
    expect(guard).toContain('/dashboard')
  })
})

// ─── scopeMatchesUrl ─────────────────────────────────────────────────────────

describe('scopeMatchesUrl', () => {
  it('matches all URLs when host is empty', () => {
    expect(scopeMatchesUrl({ scheme: '*', host: '', path: '/*' }, 'https://anything.com/page')).toBe(true)
    expect(scopeMatchesUrl({ scheme: '*', host: '', path: '/*' }, 'http://other.com')).toBe(true)
  })

  it('matches the exact host', () => {
    const cfg = { scheme: '*', host: 'example.com', path: '/*' }
    expect(scopeMatchesUrl(cfg, 'https://example.com/page')).toBe(true)
    expect(scopeMatchesUrl(cfg, 'https://other.com/page')).toBe(false)
  })

  it('does not match a subdomain when host has no wildcard', () => {
    const cfg = { scheme: '*', host: 'example.com', path: '/*' }
    expect(scopeMatchesUrl(cfg, 'https://sub.example.com/page')).toBe(false)
  })

  it('matches a subdomain when host uses a wildcard prefix', () => {
    const cfg = { scheme: '*', host: '*.example.com', path: '/*' }
    expect(scopeMatchesUrl(cfg, 'https://sub.example.com/page')).toBe(true)
    expect(scopeMatchesUrl(cfg, 'https://example.com/page')).toBe(false)
  })

  it('rejects http URL when scheme is https-only', () => {
    const cfg = { scheme: 'https', host: 'example.com', path: '/*' }
    expect(scopeMatchesUrl(cfg, 'http://example.com/page')).toBe(false)
    expect(scopeMatchesUrl(cfg, 'https://example.com/page')).toBe(true)
  })

  it('accepts both http and https when scheme is *', () => {
    const cfg = { scheme: '*', host: 'example.com', path: '/*' }
    expect(scopeMatchesUrl(cfg, 'http://example.com/')).toBe(true)
    expect(scopeMatchesUrl(cfg, 'https://example.com/')).toBe(true)
  })

  it('matches path prefix', () => {
    const cfg = { scheme: '*', host: 'example.com', path: '/dashboard*' }
    expect(scopeMatchesUrl(cfg, 'https://example.com/dashboard/settings')).toBe(true)
    expect(scopeMatchesUrl(cfg, 'https://example.com/home')).toBe(false)
  })

  it('returns false for an unparseable URL', () => {
    const cfg = { scheme: '*', host: 'example.com', path: '/*' }
    expect(scopeMatchesUrl(cfg, 'not-a-url')).toBe(false)
  })
})

// ─── buildBeforeLoadScript ────────────────────────────────────────────────────

describe('buildBeforeLoadScript — JS', () => {
  it('wraps script in an IIFE with try/catch', () => {
    const rule = makeInjectRule()
    const out = buildBeforeLoadScript(rule)
    expect(out).toContain('(function ()')
    expect(out).toContain('try {')
    expect(out).toContain('catch (e)')
    expect(out).toContain('console.log("hello")')
  })

  it('includes [MockMate inject] warning label with rule name', () => {
    const rule = makeInjectRule({ name: 'My Rule' })
    expect(buildBeforeLoadScript(rule)).toContain('[MockMate inject]')
    expect(buildBeforeLoadScript(rule)).toContain('My Rule')
  })

  it('omits scope guard when host is empty', () => {
    const rule = makeInjectRule()
    const out = buildBeforeLoadScript(rule)
    expect(out).not.toContain('location.href')
  })

  it('includes scope guard when host is set', () => {
    const rule = makeInjectRule({
      injectScript: {
        timing: 'before_load', codeType: 'js',
        script: 'console.log("x")',
        scheme: '*', host: 'example.com', path: '/*',
      },
    })
    expect(buildBeforeLoadScript(rule)).toContain('location.href')
  })
})

describe('buildBeforeLoadScript — CSS', () => {
  it('creates a style element and sets textContent', () => {
    const rule = makeInjectRule({
      injectScript: {
        timing: 'before_load', codeType: 'css',
        script: 'body { color: red; }',
        scheme: '*', host: '', path: '/*',
      },
    })
    const out = buildBeforeLoadScript(rule)
    expect(out).toContain("document.createElement('style')")
    expect(out).toContain('__s.textContent')
    expect(out).toContain(JSON.stringify('body { color: red; }'))
  })

  it('appends to head or documentElement as fallback', () => {
    const rule = makeInjectRule({
      injectScript: {
        timing: 'before_load', codeType: 'css',
        script: '.foo { display: none }',
        scheme: '*', host: '', path: '/*',
      },
    })
    const out = buildBeforeLoadScript(rule)
    expect(out).toContain('document.head || document.documentElement')
  })

  it('handles DOMContentLoaded fallback when document.head is missing', () => {
    const rule = makeInjectRule({
      injectScript: {
        timing: 'before_load', codeType: 'css',
        script: '.x{}',
        scheme: '*', host: '', path: '/*',
      },
    })
    const out = buildBeforeLoadScript(rule)
    expect(out).toContain('DOMContentLoaded')
    expect(out).toContain('once: true')
  })

  it('JSON-encodes CSS content so special characters are safe', () => {
    const css = '.x::before { content: "he said \\"hi\\""; }'
    const rule = makeInjectRule({
      injectScript: {
        timing: 'before_load', codeType: 'css',
        script: css,
        scheme: '*', host: '', path: '/*',
      },
    })
    const out = buildBeforeLoadScript(rule)
    expect(out).toContain(JSON.stringify(css))
  })

  it('includes scope guard when host is set', () => {
    const rule = makeInjectRule({
      injectScript: {
        timing: 'before_load', codeType: 'css',
        script: 'body{}',
        scheme: 'https', host: 'example.com', path: '/*',
      },
    })
    expect(buildBeforeLoadScript(rule)).toContain('location.href')
  })
})

// ─── buildTimedScript ─────────────────────────────────────────────────────────

describe('buildTimedScript — JS', () => {
  it('wraps script in IIFE with try/catch', () => {
    const rule = makeInjectRule({
      injectScript: {
        timing: 'dom_ready', codeType: 'js',
        script: 'window.flag = true',
        scheme: '*', host: '', path: '/*',
      },
    })
    const out = buildTimedScript(rule)
    expect(out).toContain('(function ()')
    expect(out).toContain('window.flag = true')
    expect(out).toContain('catch (e)')
  })

  it('does not include scope guard (server-side check handles scoping)', () => {
    const rule = makeInjectRule({
      injectScript: {
        timing: 'dom_ready', codeType: 'js',
        script: 'void 0',
        scheme: '*', host: 'example.com', path: '/*',
      },
    })
    expect(buildTimedScript(rule)).not.toContain('location.href')
  })
})

describe('buildTimedScript — CSS', () => {
  it('creates a style element appended to document.head', () => {
    const rule = makeInjectRule({
      injectScript: {
        timing: 'dom_ready', codeType: 'css',
        script: 'p { color: blue; }',
        scheme: '*', host: '', path: '/*',
      },
    })
    const out = buildTimedScript(rule)
    expect(out).toContain("document.createElement('style')")
    expect(out).toContain('document.head.appendChild(__s)')
    expect(out).toContain(JSON.stringify('p { color: blue; }'))
  })

  it('JSON-encodes CSS to handle quotes and backslashes safely', () => {
    const css = 'a::after { content: "\\2192" }'
    const rule = makeInjectRule({
      injectScript: {
        timing: 'after_load', codeType: 'css',
        script: css,
        scheme: '*', host: '', path: '/*',
      },
    })
    expect(buildTimedScript(rule)).toContain(JSON.stringify(css))
  })

  it('includes rule name in the [MockMate inject] warning', () => {
    const rule = makeInjectRule({
      name: 'QA Banner',
      injectScript: {
        timing: 'dom_ready', codeType: 'css',
        script: 'body{}',
        scheme: '*', host: '', path: '/*',
      },
    })
    expect(buildTimedScript(rule)).toContain('QA Banner')
  })
})
