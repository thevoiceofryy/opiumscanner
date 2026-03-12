'use client'

export function TerminalHeader() {
  return (
    <div className="h-12 border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <span className="font-semibold">⚡ SigmaTerminal</span>
        <span className="text-xs text-green-500">LIVE</span>
      </div>
    </div>
  )
}