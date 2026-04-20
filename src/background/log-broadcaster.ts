import { PortMessage } from '@/types'

const logPorts = new Set<chrome.runtime.Port>()

export function registerLogPort(port: chrome.runtime.Port): void {
  logPorts.add(port)
  port.onDisconnect.addListener(() => logPorts.delete(port))
}

export function broadcastLogMessage(msg: PortMessage): void {
  for (const port of logPorts) {
    try {
      port.postMessage(msg)
    } catch {
      logPorts.delete(port)
    }
  }
}
