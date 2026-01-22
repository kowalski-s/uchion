import { useState, useEffect } from 'react'
import { useSessionStore } from '../store/session'

interface BuyGenerationsModalProps {
  isOpen: boolean
  onClose: () => void
}

function CloseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

// Pricing configuration
const PRICE_PER_GENERATION = 20  // rubles
const MIN_GENERATIONS = 5
const MAX_GENERATIONS = 200

// Popular options for quick selection
const POPULAR_OPTIONS = [
  { count: 10, discount: 0 },
  { count: 30, discount: 1 },   // -1%
  { count: 100, discount: 4 },  // -4%
]

export default function BuyGenerationsModal({ isOpen, onClose }: BuyGenerationsModalProps) {
  const [generationsCount, setGenerationsCount] = useState(MIN_GENERATIONS)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { user } = useSessionStore()
  const currentBalance = user?.generationsLeft ?? 0

  // Calculate price with potential discount
  const calculatePrice = (count: number) => {
    const option = POPULAR_OPTIONS.find(o => o.count === count)
    const basePrice = count * PRICE_PER_GENERATION
    if (option && option.discount > 0) {
      return Math.round(basePrice * (1 - option.discount / 100))
    }
    return basePrice
  }

  const totalPrice = calculatePrice(generationsCount)
  const hasDiscount = POPULAR_OPTIONS.some(o => o.count === generationsCount && o.discount > 0)
  const currentDiscount = POPULAR_OPTIONS.find(o => o.count === generationsCount)?.discount || 0

  async function handlePurchase() {
    try {
      setPurchasing(true)
      setError(null)

      const res = await fetch('/api/billing/prodamus/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationsCount }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка при создании платежа')
      }

      const data = await res.json()

      // Redirect to payment page
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании платежа')
      console.error(err)
    } finally {
      setPurchasing(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-slate-400" />
          </button>

          <h2 className="text-2xl font-bold text-center">
            Пополнить <span className="text-[#8C52FF]">генерации</span>
          </h2>

          {/* Balance badge */}
          <div className="flex justify-center mt-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
              <span className="text-slate-600 text-sm">Баланс генераций:</span>
              <span className="font-bold text-slate-900">{currentBalance}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Slider section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600">Количество генераций:</span>
              <span className="text-xl font-bold text-slate-900">{generationsCount}</span>
            </div>

            <input
              type="range"
              min={MIN_GENERATIONS}
              max={MAX_GENERATIONS}
              value={generationsCount}
              onChange={(e) => setGenerationsCount(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gradient-to-r from-purple-200 to-purple-400 rounded-lg appearance-none cursor-pointer slider-thumb"
              style={{
                background: `linear-gradient(to right, #8C52FF 0%, #8C52FF ${((generationsCount - MIN_GENERATIONS) / (MAX_GENERATIONS - MIN_GENERATIONS)) * 100}%, #e2e8f0 ${((generationsCount - MIN_GENERATIONS) / (MAX_GENERATIONS - MIN_GENERATIONS)) * 100}%, #e2e8f0 100%)`
              }}
            />

            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>{MIN_GENERATIONS}</span>
              <span>{MAX_GENERATIONS}</span>
            </div>
          </div>

          {/* Popular options */}
          <div className="mb-6">
            <p className="text-center text-slate-500 text-sm mb-3">Популярные варианты:</p>
            <div className="grid grid-cols-3 gap-3">
              {POPULAR_OPTIONS.map((option) => (
                <button
                  key={option.count}
                  onClick={() => setGenerationsCount(option.count)}
                  className={`relative p-3 rounded-xl border-2 transition-all ${
                    generationsCount === option.count
                      ? 'border-[#8C52FF] bg-purple-50'
                      : 'border-slate-200 hover:border-[#8C52FF]/50 bg-white'
                  }`}
                >
                  {option.discount > 0 && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-pink-500 text-white text-xs font-bold rounded-full">
                      -{option.discount}%
                    </span>
                  )}
                  <div className="text-xl font-bold text-slate-900">{option.count}</div>
                  <div className="text-xs text-slate-500">генераций</div>
                  <div className="text-sm font-semibold text-slate-600 mt-1">
                    {calculatePrice(option.count)} ₽
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Price info */}
          <div className="mb-4 text-center">
            <p className="text-slate-500 text-sm">
              Цена за генерацию: <span className="font-semibold text-slate-700">{PRICE_PER_GENERATION} ₽</span>
              {hasDiscount && (
                <span className="ml-2 text-pink-500 font-semibold">(-{currentDiscount}%)</span>
              )}
            </p>
          </div>

          {/* Total */}
          <div className="mb-4 text-center">
            <p className="text-slate-600 text-lg">
              Итого: <span className="text-2xl font-bold text-slate-900">{totalPrice} ₽</span>
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          {/* Purchase button */}
          <button
            onClick={handlePurchase}
            disabled={purchasing}
            className={`w-full py-4 rounded-xl text-white font-semibold text-lg transition-all ${
              purchasing
                ? 'bg-purple-300 cursor-wait'
                : 'bg-[#8C52FF] hover:bg-purple-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {purchasing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                Загрузка...
              </span>
            ) : (
              'Купить генерации'
            )}
          </button>
        </div>
      </div>

      {/* Custom slider thumb styles */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 3px solid #8C52FF;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 3px solid #8C52FF;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  )
}
