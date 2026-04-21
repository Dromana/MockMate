import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
            error ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {helpText && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{helpText}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
