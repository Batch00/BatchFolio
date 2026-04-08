'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Input } from '@/components/ui/input'

function relativeTime(isoString) {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function SettingsTab({ isDemo, onDemoBlock }) {
  const supabase = createClient()

  const [connection, setConnection] = useState(null)
  const [loadingConn, setLoadingConn] = useState(true)

  const [setupToken, setSetupToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(null)

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncError, setSyncError] = useState(null)

  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)
  function showToast(msg, isError = false) {
    setToast({ msg, isError })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadConnection() {
    setLoadingConn(true)
    const { data } = await supabase
      .from('simplefin_connections')
      .select('last_synced_at')
      .maybeSingle()
    setConnection(data ?? null)
    setLoadingConn(false)
  }

  useEffect(() => {
    loadConnection()
  }, [])

  async function handleConnect(e) {
    e.preventDefault()
    if (isDemo) { onDemoBlock?.(); return }
    if (!setupToken.trim()) return
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await fetch('/api/simplefin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken: setupToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Connection failed')
      setSetupToken('')
      await loadConnection()
      // Trigger initial sync
      await handleSync(true)
    } catch (err) {
      setConnectError(err.message)
    } finally {
      setConnecting(false)
    }
  }

  async function handleSync(silent = false) {
    if (isDemo) { onDemoBlock?.(); return }
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const res = await fetch('/api/simplefin/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Sync failed')
      if (data.alreadySynced) {
        showToast(data.message)
      } else {
        setSyncResult(data)
        showToast(`Sync complete - ${data.accountsSynced} accounts, ${data.holdingsSynced} holdings updated`)
        await loadConnection()
      }
    } catch (err) {
      if (!silent) setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (isDemo) { onDemoBlock?.(); return }
    setDisconnecting(true)
    try {
      const res = await fetch('/api/simplefin/disconnect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Disconnect failed')
      setConnection(null)
      setDisconnectConfirm(false)
      showToast('Disconnected from SimpleFIN')
    } catch (err) {
      showToast(err.message, true)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="p-4 max-w-xl space-y-6">
      {/* Bank Sync Section */}
      <div
        className="bg-[#161b22] border border-[#21262d] rounded-md p-4 space-y-4"
      >
        <p
          className="text-[10px] uppercase text-[#7d8590] font-mono"
          style={{ letterSpacing: '0.08em' }}
        >
          Bank Sync
        </p>

        {loadingConn ? (
          <div className="space-y-2">
            <div className="h-4 bg-[#21262d] rounded animate-pulse w-48" />
            <div className="h-4 bg-[#21262d] rounded animate-pulse w-64" />
          </div>
        ) : connection ? (
          // Connected state
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full bg-[#34d399] flex-shrink-0"
              />
              <span className="text-sm text-[#e6edf3]">Connected via SimpleFIN Bridge</span>
            </div>
            {connection.last_synced_at && (
              <p className="text-xs text-[#7d8590]">
                Last synced: {relativeTime(connection.last_synced_at)}
              </p>
            )}
            {syncError && (
              <p className="text-xs text-[#f87171]">{syncError}</p>
            )}
            {syncResult && (
              <p className="text-xs text-[#34d399]">
                Synced {syncResult.accountsSynced} accounts, {syncResult.holdingsSynced} holdings
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => handleSync()}
                disabled={syncing}
                className="px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50"
                style={{
                  color: '#10b981',
                  borderColor: 'rgba(16,185,129,0.4)',
                  background: 'rgba(16,185,129,0.06)',
                }}
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>

              {!disconnectConfirm ? (
                <button
                  onClick={() => setDisconnectConfirm(true)}
                  className="text-xs text-[#f87171] hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#7d8590]">Are you sure?</span>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-xs text-[#f87171] hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {disconnecting ? 'Disconnecting...' : 'Yes, disconnect'}
                  </button>
                  <button
                    onClick={() => setDisconnectConfirm(false)}
                    className="text-xs text-[#7d8590] hover:text-[#e6edf3] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Not connected state
          <div className="space-y-3">
            <p className="text-sm text-[#7d8590] leading-relaxed">
              Connect your financial institutions via SimpleFIN Bridge to automatically
              sync accounts and holdings. Requires a SimpleFIN account ($15/year).
            </p>
            <p className="text-xs">
              <a
                href="https://beta-bridge.simplefin.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#10b981] hover:text-[#34d399] transition-colors"
              >
                Get SimpleFIN
              </a>
            </p>
            <form onSubmit={handleConnect} className="space-y-3">
              <Input
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Paste your SimpleFIN setup token"
                className="font-mono text-xs"
                required
              />
              {connectError && (
                <p className="text-xs text-[#f87171]">{connectError}</p>
              )}
              <button
                type="submit"
                disabled={connecting || !setupToken.trim()}
                className="px-4 py-2 text-xs rounded transition-colors disabled:opacity-50"
                style={{
                  color: '#0d1117',
                  background: connecting ? 'rgba(16,185,129,0.6)' : '#10b981',
                }}
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 space-y-3">
        <p
          className="text-[10px] uppercase text-[#7d8590] font-mono"
          style={{ letterSpacing: '0.08em' }}
        >
          Account
        </p>
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
          className="text-xs text-[#7d8590] hover:text-[#e6edf3] transition-colors border border-[#21262d] rounded px-3 py-1.5"
        >
          Sign out
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 z-50 px-4 py-3 rounded-md border shadow-lg max-w-xs"
          style={{
            background: '#161b22',
            borderColor: toast.isError ? '#f87171' : '#21262d',
          }}
        >
          <p
            className="text-sm"
            style={{ color: toast.isError ? '#f87171' : '#e6edf3' }}
          >
            {toast.msg}
          </p>
        </div>
      )}
    </div>
  )
}
