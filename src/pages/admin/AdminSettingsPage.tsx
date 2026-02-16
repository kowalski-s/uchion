import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAdminSettings, updateTelegramChatId, removeTelegramChatId, sendTestAlert } from '../../lib/admin-api'

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const [chatId, setChatId] = useState('')
  const [chatIdError, setChatIdError] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchAdminSettings,
    staleTime: 10_000,
  })

  // Sync input with loaded settings
  const displayChatId = chatId || settings?.telegramChatId || ''

  const saveMutation = useMutation({
    mutationFn: (id: string) => updateTelegramChatId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      setChatIdError('')
      setChatId('')
    },
    onError: (err: Error) => {
      setChatIdError(err.message)
    },
  })

  const removeMutation = useMutation({
    mutationFn: removeTelegramChatId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      setChatId('')
      setChatIdError('')
    },
  })

  const testMutation = useMutation({
    mutationFn: () => sendTestAlert(),
    onSuccess: (data) => {
      setTestResult(data.message)
      setTimeout(() => setTestResult(null), 5000)
    },
    onError: (err: Error) => {
      setTestResult(err.message)
      setTimeout(() => setTestResult(null), 5000)
    },
  })

  function handleSave() {
    const value = chatId || settings?.telegramChatId || ''
    if (!value) {
      setChatIdError('Введите Chat ID')
      return
    }
    if (!/^\d+$/.test(value)) {
      setChatIdError('Chat ID должен содержать только цифры')
      return
    }
    setChatIdError('')
    saveMutation.mutate(value)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="relative">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200"></div>
          <div className="absolute inset-0 animate-spin rounded-full h-8 w-8 border-t-2 border-[#8C52FF]"></div>
        </div>
      </div>
    )
  }

  const isLinked = !!settings?.telegramChatId && settings.wantsAlerts

  return (
    <div className="space-y-6">
      {/* Telegram Notifications */}
      <div className="glass-container p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <TelegramIcon className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Telegram-уведомления</h2>
            <p className="text-sm text-slate-500">Получайте алерты о сбоях генерации в Telegram</p>
          </div>
          <div className="ml-auto">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              isLinked
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLinked ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {isLinked ? 'Включены' : 'Выключены'}
            </span>
          </div>
        </div>

        {/* Chat ID input */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Telegram Chat ID
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={displayChatId}
              onChange={(e) => {
                setChatId(e.target.value)
                setChatIdError('')
              }}
              placeholder="123456789"
              className={`flex-1 px-4 py-2.5 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8C52FF]/30 focus:border-[#8C52FF] transition-colors ${
                chatIdError ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-5 py-2.5 bg-[#8C52FF] text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
          {chatIdError && (
            <p className="text-sm text-red-500">{chatIdError}</p>
          )}
          {saveMutation.isSuccess && !chatIdError && (
            <p className="text-sm text-emerald-600">Chat ID сохранен</p>
          )}

          <p className="text-xs text-slate-400">
            Отправьте <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-600">/start</code> боту{' '}
            <a
              href="https://t.me/userinfobot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8C52FF] hover:underline"
            >
              @userinfobot
            </a>
            , чтобы узнать свой Chat ID
          </p>
        </div>

        {/* Actions */}
        {isLinked && (
          <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100">
            <button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {testMutation.isPending ? 'Отправка...' : 'Тестовый алерт'}
            </button>
            <button
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {removeMutation.isPending ? 'Отключение...' : 'Отключить'}
            </button>
          </div>
        )}

        {testResult && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-sm">
            {testResult}
          </div>
        )}
      </div>
    </div>
  )
}

function TelegramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  )
}
