import { UseFormRegister, FieldErrors, Controller, Control } from 'react-hook-form'
import { RuleFormValues } from './RuleEditorModal'
import { BodyEditor } from './BodyEditor'
import { HeadersEditor } from './HeadersEditor'
import { COMMON_STATUS_CODES } from '@/constants'

interface ResponseSectionProps {
  register: UseFormRegister<RuleFormValues>
  errors: FieldErrors<RuleFormValues>
  control: Control<RuleFormValues>
}

export function ResponseSection({ register, errors, control }: ResponseSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Status Code</label>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="number"
            className={`w-20 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
              errors.statusCode ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            {...register('statusCode', { valueAsNumber: true })}
          />
          <div className="flex flex-wrap gap-1">
            {COMMON_STATUS_CODES.map((code) => (
              <Controller
                key={code}
                name="statusCode"
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(code)}
                    className={`px-1.5 py-0.5 rounded text-xs font-mono cursor-pointer ${
                      field.value === code
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {code}
                  </button>
                )}
              />
            ))}
          </div>
        </div>
        {errors.statusCode && <p className="text-xs text-red-600">{errors.statusCode.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Response Headers</label>
        <Controller
          name="responseHeaders"
          control={control}
          render={({ field }) => (
            <HeadersEditor headers={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <Controller
        name="body"
        control={control}
        render={({ field: bodyField }) => (
          <Controller
            name="bodyType"
            control={control}
            render={({ field: typeField }) => (
              <BodyEditor
                body={bodyField.value}
                bodyType={typeField.value}
                onBodyChange={bodyField.onChange}
                onBodyTypeChange={typeField.onChange}
                error={errors.body?.message}
              />
            )}
          />
        )}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Response Delay: <Controller
            name="delayMs"
            control={control}
            render={({ field }) => <span className="font-mono">{field.value}ms</span>}
          />
        </label>
        <input
          type="range"
          min={0}
          max={5000}
          step={100}
          className="w-full"
          {...register('delayMs', { valueAsNumber: true })}
        />
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>0ms</span>
          <span>5000ms</span>
        </div>
      </div>
    </div>
  )
}
