import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { Input } from '../shared/Input'
import { MatchSection } from './MatchSection'
import { ResponseSection } from './ResponseSection'
import { RequestOverrideSection } from './RequestOverrideSection'
import { ModifyHeadersSection } from './ModifyHeadersSection'
import { ModifyQueryParamsSection } from './ModifyQueryParamsSection'
import { RedirectSection } from './RedirectSection'
import { useRulesStore } from '@/panel/store/rules-store'
import { useUIStore } from '@/panel/store/ui-store'
import { MockRule, HttpMethod, BodyType, UrlPatternType, RuleAction } from '@/types'
import { HeaderEntry } from './HeadersEditor'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  urlPattern: z.string().min(1, 'URL pattern is required'),
  urlPatternType: z.enum(['glob', 'exact', 'regex'] as const),
  methods: z.array(z.string()),
  statusCode: z.number().int().min(100).max(599),
  responseHeaders: z.array(z.object({ name: z.string(), value: z.string() })),
  bodyType: z.enum(['json', 'html', 'text', 'empty'] as const),
  body: z.string(),
  delayMs: z.number().min(0).max(5000),
  graphqlOperationName: z.string().optional(),
  action: z.enum(['mock_response', 'mock_request', 'modify_headers', 'modify_query_params', 'redirect'] as const),
  requestOverride: z.object({
    body: z.string(),
    bodyType: z.enum(['json', 'text', 'empty'] as const),
    additionalHeaders: z.array(z.object({ name: z.string(), value: z.string() })),
  }),
  headersModification: z.object({
    requestHeaders: z.array(z.object({ operation: z.enum(['set', 'remove'] as const), name: z.string(), value: z.string() })),
    responseHeaders: z.array(z.object({ operation: z.enum(['set', 'remove'] as const), name: z.string(), value: z.string() })),
  }),
  queryParamsModification: z.object({
    params: z.array(z.object({ operation: z.enum(['set', 'remove'] as const), name: z.string(), value: z.string() })),
  }),
  redirectConfig: z.object({
    from: z.string(),
    to: z.string(),
    matchType: z.enum(['text', 'regex'] as const),
  }),
})

export type RuleFormValues = z.infer<typeof schema>

function ruleToForm(rule: MockRule): RuleFormValues {
  return {
    name: rule.name,
    urlPattern: rule.match.urlPattern,
    urlPatternType: rule.match.urlPatternType,
    methods: rule.match.methods,
    statusCode: rule.response.statusCode,
    responseHeaders: Object.entries(rule.response.headers).map(([name, value]) => ({ name, value })),
    bodyType: rule.response.bodyType,
    body: rule.response.body,
    delayMs: rule.response.delayMs,
    graphqlOperationName: rule.match.graphqlOperationName ?? '',
    action: rule.action ?? 'mock_response',
    requestOverride: {
      body: rule.requestOverride?.body ?? '',
      bodyType: rule.requestOverride?.bodyType ?? 'json',
      additionalHeaders: Object.entries(rule.requestOverride?.additionalHeaders ?? {}).map(([name, value]) => ({ name, value })),
    },
    headersModification: {
      requestHeaders: rule.headersModification?.requestHeaders ?? [],
      responseHeaders: rule.headersModification?.responseHeaders ?? [],
    },
    queryParamsModification: {
      params: rule.queryParamsModification?.params ?? [],
    },
    redirectConfig: {
      from: rule.redirectConfig?.from ?? '',
      to: rule.redirectConfig?.to ?? '',
      matchType: rule.redirectConfig?.matchType ?? 'text',
    },
  }
}

const defaultValues: RuleFormValues = {
  name: '',
  urlPattern: '',
  urlPatternType: 'glob',
  methods: [],
  statusCode: 200,
  responseHeaders: [],
  bodyType: 'json',
  body: '',
  delayMs: 0,
  graphqlOperationName: '',
  action: 'mock_response',
  requestOverride: {
    body: '',
    bodyType: 'json',
    additionalHeaders: [],
  },
  headersModification: {
    requestHeaders: [],
    responseHeaders: [],
  },
  queryParamsModification: {
    params: [],
  },
  redirectConfig: {
    from: '',
    to: '',
    matchType: 'text',
  },
}

const MATCH_FIELDS = ['urlPattern', 'urlPatternType', 'methods', 'graphqlOperationName'] as const
const RESPONSE_FIELDS = ['statusCode', 'responseHeaders', 'body', 'bodyType', 'delayMs', 'requestOverride'] as const

export function RuleEditorModal() {
  const { isEditorOpen, editingRule, prefillValues, closeEditor } = useUIStore()
  const { addRule, updateRule } = useRulesStore()
  const [activeTab, setActiveTab] = useState<'match' | 'response'>('match')
  const [submitErrors, setSubmitErrors] = useState<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  const { register, handleSubmit, control, reset, watch, setValue, setError, formState: { errors } } = useForm<RuleFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const action = watch('action')

  const matchHasError = MATCH_FIELDS.some((f) => f in errors)
  const responseHasError = RESPONSE_FIELDS.some((f) => f in errors)

  useEffect(() => {
    if (isEditorOpen) {
      setSubmitErrors([])
      if (editingRule) {
        reset(ruleToForm(editingRule))
      } else if (prefillValues) {
        const { responseHeaders: prefillHeaders, action: prefillAction, requestBody, requestHeaders, queryParams, ...rest } = prefillValues
        const headersArray = prefillHeaders
          ? Object.entries(prefillHeaders).map(([name, value]) => ({ name, value }))
          : defaultValues.responseHeaders

        const detectBodyType = (body: string | undefined): 'json' | 'text' | 'empty' => {
          if (!body || body.trim() === '') return 'empty'
          try { JSON.parse(body); return 'json' } catch { return 'text' }
        }

        const requestOverride = (requestBody !== undefined || requestHeaders !== undefined)
          ? {
              body: requestBody ?? '',
              bodyType: detectBodyType(requestBody),
              additionalHeaders: Object.entries(requestHeaders ?? {}).map(([name, value]) => ({ name, value })),
            }
          : defaultValues.requestOverride

        const queryParamsModification = queryParams
          ? { params: queryParams.map(([name, value]) => ({ operation: 'set' as const, name, value })) }
          : defaultValues.queryParamsModification

        reset({
          ...defaultValues,
          ...rest,
          responseHeaders: headersArray,
          ...(prefillAction ? { action: prefillAction } : {}),
          requestOverride,
          queryParamsModification,
        })
        setActiveTab(prefillAction === 'mock_request' || prefillAction === 'modify_query_params' ? 'response' : 'match')
      } else {
        reset(defaultValues)
        setActiveTab('match')
      }
    }
  }, [isEditorOpen, editingRule, prefillValues, reset])

  const onValidationError = (errs: typeof errors) => {
    const messages: string[] = []
    if (errs.name?.message)        messages.push(errs.name.message)
    if (errs.urlPattern?.message)  messages.push(errs.urlPattern.message)
    if (errs.statusCode?.message)  messages.push(errs.statusCode.message)
    if (errs.body?.message)        messages.push(errs.body.message)
    const reqBodyErr = (errs.requestOverride as Record<string, { message?: string } | undefined> | undefined)?.body?.message
    if (reqBodyErr)                messages.push(reqBodyErr)
    if (messages.length === 0)     messages.push('Please fix the highlighted errors before saving.')

    const hasMatchError = MATCH_FIELDS.some((f) => f in errs)
    const hasResponseError = RESPONSE_FIELDS.some((f) => f in errs)
    if (hasMatchError) setActiveTab('match')
    else if (hasResponseError) setActiveTab('response')
    setSubmitErrors(messages)
  }

  const onSubmit = (values: RuleFormValues) => {
    console.log('[MockMate] onSubmit called with:', values.name, values.urlPattern)
    setSubmitErrors([])

    // JSON validation (moved out of Zod .refine() for Zod v4 compatibility)
    if (values.bodyType === 'json' && values.body.trim()) {
      try { JSON.parse(values.body) } catch {
        setError('body', { message: 'Invalid JSON' })
        setActiveTab('response')
        return
      }
    }
    if (values.action === 'mock_request' && values.requestOverride.bodyType === 'json' && values.requestOverride.body.trim()) {
      try { JSON.parse(values.requestOverride.body) } catch {
        setError('requestOverride.body' as 'requestOverride', { message: 'Invalid JSON' })
        setActiveTab('response')
        return
      }
    }
    const headersRecord = values.responseHeaders.reduce<Record<string, string>>((acc, { name, value }) => {
      if (name) acc[name] = value
      return acc
    }, {})

    const ruleData: Omit<MockRule, 'id' | 'createdAt' | 'updatedAt'> = {
      name: values.name,
      enabled: editingRule?.enabled ?? true,
      action: values.action,
      match: {
        urlPattern: values.urlPattern,
        urlPatternType: values.urlPatternType as UrlPatternType,
        methods: values.methods as HttpMethod[],
        graphqlOperationName: values.graphqlOperationName || undefined,
      },
      response: {
        statusCode: values.statusCode,
        headers: headersRecord,
        body: values.body,
        bodyType: values.bodyType as BodyType,
        delayMs: values.delayMs,
      },
      requestOverride: values.action === 'mock_request'
        ? {
            body: values.requestOverride.body,
            bodyType: values.requestOverride.bodyType,
            additionalHeaders: values.requestOverride.additionalHeaders.reduce<Record<string, string>>(
              (acc, { name, value }) => { if (name) acc[name] = value; return acc },
              {},
            ),
          }
        : undefined,
      headersModification: values.action === 'modify_headers'
        ? {
            requestHeaders: values.headersModification.requestHeaders.filter((e) => e.name),
            responseHeaders: values.headersModification.responseHeaders.filter((e) => e.name),
          }
        : undefined,
      queryParamsModification: values.action === 'modify_query_params'
        ? { params: values.queryParamsModification.params.filter((e) => e.name) }
        : undefined,
      redirectConfig: values.action === 'redirect'
        ? { from: values.redirectConfig.from, to: values.redirectConfig.to, matchType: values.redirectConfig.matchType }
        : undefined,
    }

    if (editingRule) {
      updateRule(editingRule.id, ruleData)
    } else {
      addRule(ruleData)
    }

    closeEditor()
  }

  return (
    <Modal
      isOpen={isEditorOpen}
      onClose={closeEditor}
      title={editingRule ? 'Edit Rule' : 'New Rule'}
      footer={
        <>
          <Button variant="secondary" onClick={closeEditor}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              console.log('[MockMate] Create Rule clicked, formRef:', !!formRef.current)
              formRef.current?.requestSubmit()
            }}
          >
            {editingRule ? 'Save Changes' : 'Create Rule'}
          </Button>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit(onSubmit, onValidationError)} className="flex flex-col gap-4">
        {submitErrors.length > 0 && (
          <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2 flex flex-col gap-0.5">
            {submitErrors.map((msg, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="shrink-0">·</span>{msg}
              </span>
            ))}
          </div>
        )}
        <Input
          label="Rule Name"
          placeholder="e.g. Mock empty cart"
          error={errors.name?.message}
          {...register('name')}
        />

        {/* Action toggle */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Rule Mode</label>
          <div className="flex flex-wrap gap-1">
            {([
              ['mock_response', 'Mock Response'],
              ['mock_request', 'Mock Request'],
              ['modify_headers', 'Modify Headers'],
              ['modify_query_params', 'Query Params'],
              ['redirect', 'Redirect'],
            ] as [RuleAction, string][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setValue('action', mode)}
                className={`px-3 py-1.5 text-xs font-medium cursor-pointer rounded border ${
                  action === mode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {action === 'mock_response' && 'Intercept the request and return a fake response (server never receives it).'}
            {action === 'mock_request' && 'Forward the request to the real server with an overridden body/headers.'}
            {action === 'modify_headers' && 'Forward the request, injecting or removing request/response headers.'}
            {action === 'modify_query_params' && 'Forward the request with added, overridden, or removed query parameters.'}
            {action === 'redirect' && 'Rewrite part of the request URL — useful for pointing requests at a different host or environment.'}
          </p>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(['match', 'response'] as const).map((tab) => {
            const hasError = tab === 'match' ? matchHasError : responseHasError
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'response'
                  ? action === 'mock_request' ? 'Request Override'
                  : action === 'modify_headers' ? 'Headers'
                  : action === 'modify_query_params' ? 'Query Params'
                  : action === 'redirect' ? 'Redirect'
                  : 'Response'
                  : tab}
                {hasError && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />}
              </button>
            )
          })}
        </div>

        {activeTab === 'match' && (
          <MatchSection register={register} errors={errors} control={control} />
        )}
        {activeTab === 'response' && action === 'mock_response' && (
          <ResponseSection register={register} errors={errors} control={control} />
        )}
        {activeTab === 'response' && action === 'mock_request' && (
          <RequestOverrideSection errors={errors} control={control} />
        )}
        {activeTab === 'response' && action === 'modify_headers' && (
          <ModifyHeadersSection control={control} />
        )}
        {activeTab === 'response' && action === 'modify_query_params' && (
          <ModifyQueryParamsSection control={control} />
        )}
        {activeTab === 'response' && action === 'redirect' && (
          <RedirectSection control={control} />
        )}
      </form>
    </Modal>
  )
}
