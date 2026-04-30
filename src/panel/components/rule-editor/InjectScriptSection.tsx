import { useController, useWatch } from 'react-hook-form'
import type { Control } from 'react-hook-form'
import type { RuleFormValues } from './RuleEditorModal'

const JS_TIMING_OPTIONS = [
  {
    value: 'before_load' as const,
    label: 'Before page loads',
    description: 'Runs before any page scripts — ideal for overriding cookies, globals, or stubbing APIs',
  },
  {
    value: 'dom_ready' as const,
    label: 'After DOM ready',
    description: 'Runs after HTML is parsed but before images and async scripts finish loading',
  },
  {
    value: 'after_load' as const,
    label: 'After page loads',
    description: 'Runs after everything is loaded and the app is fully initialised',
  },
]

const CSS_TIMING_OPTIONS = [
  {
    value: 'before_load' as const,
    label: 'Before page loads',
    description: 'Injects CSS as soon as the DOM head is available — applied before page stylesheets',
  },
  {
    value: 'dom_ready' as const,
    label: 'After DOM ready',
    description: 'Injects CSS after HTML is parsed but before images and async scripts load',
  },
  {
    value: 'after_load' as const,
    label: 'After page loads',
    description: 'Injects CSS after everything is loaded and the app is fully initialised',
  },
]

export function InjectScriptSection({ control }: { control: Control<RuleFormValues> }) {
  const { field: schemeField }   = useController({ control, name: 'injectScript.scheme' })
  const { field: hostField }     = useController({ control, name: 'injectScript.host' })
  const { field: pathField }     = useController({ control, name: 'injectScript.path' })
  const { field: timingField }   = useController({ control, name: 'injectScript.timing' })
  const { field: scriptField }   = useController({ control, name: 'injectScript.script' })
  const { field: codeTypeField } = useController({ control, name: 'injectScript.codeType' })

  const scheme   = useWatch({ control, name: 'injectScript.scheme' })
  const host     = useWatch({ control, name: 'injectScript.host' })
  const path     = useWatch({ control, name: 'injectScript.path' })
  const codeType = useWatch({ control, name: 'injectScript.codeType' })

  const preview = host
    ? `${scheme}://${host}${path || '/*'}`
    : `${scheme}://*/*`

  const timingOptions = codeType === 'css' ? CSS_TIMING_OPTIONS : JS_TIMING_OPTIONS

  const jsPlaceholder =
    `// Example: override a location cookie\ndocument.cookie = 'geo_location=US; path=/'\n\n` +
    `// Example: stub a feature flag\nwindow.featureFlags = { newCheckout: true }`

  const cssPlaceholder =
    `/* Example: hide a cookie banner */\n.cookie-banner { display: none !important; }\n\n` +
    `/* Example: highlight all buttons */\nbutton { outline: 2px solid red !important; }`

  return (
    <div className="flex flex-col gap-5">

      {/* Code type toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Code type</label>
        <div className="flex gap-1">
          {(['js', 'css'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => codeTypeField.onChange(type)}
              className={`px-4 py-1.5 text-xs font-medium rounded border cursor-pointer transition-colors ${
                codeType === type
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {type === 'js' ? 'JavaScript' : 'CSS'}
            </button>
          ))}
        </div>
      </div>

      {/* URL Scope */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">URL scope</label>
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">leave Host empty to match all pages</span>
        </div>

        <div className="flex gap-2 items-center">
          {/* Scheme */}
          <select
            {...schemeField}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
          >
            <option value="https">https</option>
            <option value="http">http</option>
            <option value="*">http / https</option>
          </select>

          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">://</span>

          {/* Host */}
          <input
            {...hostField}
            type="text"
            placeholder="example.com or *.example.com"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* Path */}
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 w-[calc(theme(spacing.16)+theme(spacing.5))]">Path</span>
          <input
            {...pathField}
            type="text"
            placeholder="/*"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5">
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">Matching:</span>
          <code className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">{preview}</code>
        </div>
      </div>

      {/* Timing */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Injection timing</label>
        <div className="flex flex-col gap-1.5">
          {timingOptions.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${
                timingField.value === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                value={opt.value}
                checked={timingField.value === opt.value}
                onChange={() => timingField.onChange(opt.value)}
                className="mt-0.5 shrink-0 accent-blue-600"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{opt.label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Code editor */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {codeType === 'css' ? 'CSS' : 'JavaScript'}
        </label>
        <textarea
          {...scriptField}
          rows={10}
          spellCheck={false}
          placeholder={codeType === 'css' ? cssPlaceholder : jsPlaceholder}
          className="font-mono text-xs border border-gray-300 dark:border-gray-600 rounded p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 leading-relaxed"
        />
        {codeType === 'js' ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Script is automatically wrapped in a <code className="font-mono">try/catch</code> — errors are logged to the console as <code className="font-mono">[MockMate inject]</code>.
          </p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            CSS is injected via a <code className="font-mono">&lt;style&gt;</code> element — no script tag appears in the DOM. Errors are logged as <code className="font-mono">[MockMate inject]</code>.
          </p>
        )}
      </div>

    </div>
  )
}
