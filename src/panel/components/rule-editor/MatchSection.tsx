import { UseFormRegister, FieldErrors, Controller, Control } from 'react-hook-form'
import { RuleFormValues } from './RuleEditorModal'
import { Input } from '../shared/Input'
import { HTTP_METHODS } from '@/constants'

interface MatchSectionProps {
  register: UseFormRegister<RuleFormValues>
  errors: FieldErrors<RuleFormValues>
  control: Control<RuleFormValues>
}

export function MatchSection({ register, errors, control }: MatchSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 items-end">
        <Input
          label="URL Pattern"
          placeholder="https://api.example.com/users/*"
          error={errors.urlPattern?.message}
          className="flex-1"
          {...register('urlPattern')}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Type</label>
          <select
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            {...register('urlPatternType')}
          >
            <option value="glob">Glob</option>
            <option value="exact">Exact</option>
            <option value="regex">Regex</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          GraphQL Operation Name{' '}
          <span className="font-normal text-gray-400 dark:text-gray-500">(optional — leave blank for non-GraphQL)</span>
        </label>
        <input
          type="text"
          placeholder="e.g. GetUser, CreateOrder"
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          {...register('graphqlOperationName')}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Methods (empty = all)</label>
        <Controller
          name="methods"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {HTTP_METHODS.map((method) => {
                const selected = field.value.includes(method)
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      const next = selected
                        ? field.value.filter((m) => m !== method)
                        : [...field.value, method]
                      field.onChange(next)
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-semibold cursor-pointer ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {method}
                  </button>
                )
              })}
            </div>
          )}
        />
      </div>
    </div>
  )
}
