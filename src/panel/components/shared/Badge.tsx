import { METHOD_COLORS } from '@/constants'

interface MethodBadgeProps {
  method: string
}

export function MethodBadge({ method }: MethodBadgeProps) {
  const colorClass = METHOD_COLORS[method] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${colorClass}`}>
      {method}
    </span>
  )
}

interface StatusBadgeProps {
  code: number
}

export function StatusBadge({ code }: StatusBadgeProps) {
  const color =
    code >= 500 ? 'bg-red-100 text-red-800' :
    code >= 400 ? 'bg-orange-100 text-orange-800' :
    code >= 300 ? 'bg-yellow-100 text-yellow-800' :
    'bg-green-100 text-green-800'

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>
      {code}
    </span>
  )
}

interface InjectBadgeProps {
  codeType: 'js' | 'css'
}

export function InjectBadge({ codeType }: InjectBadgeProps) {
  const color = codeType === 'css'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-semibold uppercase ${color}`}>
      {codeType}
    </span>
  )
}
