import { useEffect, useState } from 'react'

interface DebuggerStatus {
  attached: boolean
  tabId: number | null
}

export function useDebuggerStatus(): DebuggerStatus {
  const [status, setStatus] = useState<DebuggerStatus>({ attached: false, tabId: null })

  useEffect(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId

    const checkStatus = () => {
      chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId }, (response) => {
        if (chrome.runtime.lastError) return
        setStatus({ attached: response?.attached ?? false, tabId })
      })
    }

    // Attach on mount
    chrome.runtime.sendMessage({ type: 'ATTACH_DEBUGGER', tabId }, () => {
      if (chrome.runtime.lastError) return
      checkStatus()
    })

    const interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  return status
}
