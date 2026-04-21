import { Controller, Control, FieldErrors } from 'react-hook-form'
import { RuleFormValues } from './RuleEditorModal'
import { HeadersEditor } from './HeadersEditor'

type RequestBodyType = 'json' | 'text' | 'empty'

interface RequestOverrideSectionProps {
  errors: FieldErrors<RuleFormValues>
  control: Control<RuleFormValues>
}

export function RequestOverrideSection({ errors, control }: RequestOverrideSectionProps) {
  const formatJson = (body: string, onChange: (v: string) => void) => {
    try {
      onChange(JSON.stringify(JSON.parse(body), null, 2))
    } catch {
      // invalid JSON, leave as-is
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Request Body */}
      <Controller
        name="requestOverride.body"
        control={control}
        render={({ field: bodyField }) => (
          <Controller
            name="requestOverride.bodyType"
            control={control}
            render={({ field: typeField }) => {
              const bodyType = (typeField.value ?? 'json') as RequestBodyType
              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Request Body Override
                    </label>
                    <div className="flex gap-1">
                      {(['json', 'text', 'empty'] as RequestBodyType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => typeField.onChange(type)}
                          className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                            bodyType === type
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    {bodyType === 'json' && (
                      <button
                        type="button"
                        onClick={() => formatJson(bodyField.value ?? '', bodyField.onChange)}
                        className="ml-auto px-2 py-0.5 rounded text-xs font-mono bg-gray-800 dark:bg-gray-700 text-gray-100 hover:bg-gray-700 dark:hover:bg-gray-600 cursor-pointer"
                      >
                        {'{ }'} pretty
                      </button>
                    )}
                  </div>

                  {bodyType !== 'empty' && (
                    <>
                      <textarea
                        className={`w-full border rounded px-2 py-1.5 text-xs font-mono resize-y min-h-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
                          errors.requestOverride?.body
                            ? 'border-red-400'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder={
                          bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body text'
                        }
                        value={bodyField.value ?? ''}
                        onChange={(e) => bodyField.onChange(e.target.value)}
                        spellCheck={false}
                      />
                      {errors.requestOverride?.body && (
                        <p className="text-xs text-red-600">{errors.requestOverride.body.message}</p>
                      )}
                    </>
                  )}
                </div>
              )
            }}
          />
        )}
      />

      {/* Additional Request Headers */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Additional Request Headers
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          These headers will be added to (or override) the original request headers.
        </p>
        <Controller
          name="requestOverride.additionalHeaders"
          control={control}
          render={({ field }) => (
            <HeadersEditor
              headers={field.value ?? []}
              onChange={field.onChange}
              placeholder="Header-Name"
            />
          )}
        />
      </div>
    </div>
  )
}
