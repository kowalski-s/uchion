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
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-4xl mx-auto px-4 py-5 text-center">
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Мы используем{' '}
            <span className="text-[#8C52FF] underline underline-offset-2 cursor-pointer">
              cookie-файлы
            </span>{' '}
            в целях улучшения стабильности работы сайта, повышения качества обслуживания,
            обеспечения авторизации и определения Ваших предпочтений.
            Продолжая использовать наш сайт, Вы соглашаетесь на обработку
            файлов cookie, как описано в нашей{' '}
            <span className="text-[#8C52FF] underline underline-offset-2 cursor-pointer">
              Политике в отношении обработки персональных данных
            </span>.
          </p>
          <button
            onClick={handleAccept}
            className="px-8 py-2.5 rounded-full bg-[#8C52FF] text-white text-sm font-semibold hover:bg-[#7B3FE4] transition-colors"
          >
            Согласен(-на)
          </button>
        </div>
      </div>
    </div>
  )
}
