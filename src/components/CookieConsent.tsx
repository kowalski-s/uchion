import { useState, useEffect } from 'react'

const STORAGE_KEY = 'cookie_consent_accepted'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY)
    if (!accepted) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm text-slate-600 mb-3">
          Мы используем файлы cookie для корректной работы сервиса и авторизации.
        </p>
        <button
          onClick={handleAccept}
          className="w-full h-10 rounded-xl bg-[#8C52FF] text-white text-sm font-semibold hover:bg-[#7B3FE4] transition-colors"
        >
          Принять
        </button>
      </div>
    </div>
  )
}
