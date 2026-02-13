import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'

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
const BULK_DISCOUNT = 210  // flat discount for 60+ generations
const BULK_THRESHOLD = 60

// Quick-select packages (shown as mini-blocks)
const QUICK_PACKAGES = [
  { count: 15, price: 300 },
  { count: 30, price: 600 },
  { count: 60, price: 990 },
] as const

function getPrice(count: number): number {
  const basePrice = count * PRICE_PER_GENERATION
  if (count >= BULK_THRESHOLD) return basePrice - BULK_DISCOUNT
  return basePrice
}

function getBasePrice(count: number): number {
  return count * PRICE_PER_GENERATION
}

function getDiscountPercent(count: number): number {
  if (count < BULK_THRESHOLD) return 0
  const base = getBasePrice(count)
  const actual = getPrice(count)
  return Math.round(((base - actual) / base) * 100)
}

export default function BuyGenerationsModal({ isOpen, onClose }: BuyGenerationsModalProps) {
  const [generationsCount, setGenerationsCount] = useState(15)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()
  const currentBalance = user?.generationsLeft ?? 0

  const totalPrice = getPrice(generationsCount)
  const basePrice = getBasePrice(generationsCount)
  const discount = getDiscountPercent(generationsCount)
  const hasDiscount = discount > 0

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
      void err
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
          {/* Discount badge */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-600">
                <path fillRule="evenodd" d="M5.5 3A2.5 2.5 0 0 0 3 5.5v2.879a2.5 2.5 0 0 0 .732 1.767l6.5 6.5a2.5 2.5 0 0 0 3.536 0l2.878-2.878a2.5 2.5 0 0 0 0-3.536l-6.5-6.5A2.5 2.5 0 0 0 8.38 3H5.5ZM6 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              <span className="text-green-700 text-sm font-medium">Скидка до 18% от 60 генераций</span>
            </div>
          </div>

          {/* Quick-select packages */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {QUICK_PACKAGES.map((pkg) => {
              const isSelected = generationsCount === pkg.count
              const pkgBasePrice = pkg.count * PRICE_PER_GENERATION
              const pkgHasDiscount = pkg.price < pkgBasePrice
              return (
                <button
                  key={pkg.count}
                  onClick={() => setGenerationsCount(pkg.count)}
                  className={`relative flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-[#8C52FF] bg-[#8C52FF]/5 shadow-md shadow-purple-200/50'
                      : 'border-slate-200 bg-white hover:border-[#8C52FF]/40 hover:bg-slate-50'
                  }`}
                >
                  {pkgHasDiscount && (
                    <span className="absolute -top-2.5 right-1.5 px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full leading-none">
                      -{Math.round(((pkgBasePrice - pkg.price) / pkgBasePrice) * 100)}%
                    </span>
                  )}
                  <span className={`text-lg font-bold ${isSelected ? 'text-[#8C52FF]' : 'text-slate-800'}`}>
                    {pkg.count}
                  </span>
                  <span className="text-[11px] text-slate-500 mb-1">генераций</span>
                  {pkgHasDiscount && (
                    <span className="text-[11px] text-slate-400 line-through">{pkgBasePrice} &#8381;</span>
                  )}
                  <span className={`text-sm font-semibold ${isSelected ? 'text-[#8C52FF]' : 'text-slate-700'}`}>
                    {pkg.price} &#8381;
                  </span>
                </button>
              )
            })}
          </div>

          {/* Slider section */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 text-sm">Или выберите количество:</span>
              <span className="text-lg font-bold text-slate-900">{generationsCount}</span>
            </div>

            <input
              type="range"
              min={5}
              max={200}
              value={generationsCount}
              onChange={(e) => setGenerationsCount(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #8C52FF 0%, #8C52FF ${((generationsCount - 5) / (200 - 5)) * 100}%, #e2e8f0 ${((generationsCount - 5) / (200 - 5)) * 100}%, #e2e8f0 100%)`
              }}
            />

            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>5</span>
              <span>200</span>
            </div>
          </div>

          {/* Total */}
          <div className="mb-4 text-center">
            <div className="text-slate-600 text-lg">
              Итого:{' '}
              {hasDiscount && (
                <span className="text-base text-slate-400 line-through mr-1.5">{basePrice} &#8381;</span>
              )}
              <span className="text-2xl font-bold text-slate-900">{totalPrice} &#8381;</span>
              {hasDiscount && (
                <span className="ml-2 text-sm font-semibold text-green-600">-{discount}%</span>
              )}
            </div>
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
                ? 'bg-[#A855F7]/50 cursor-wait'
                : 'bg-[#A855F7]/80 hover:bg-[#A855F7]/90 shadow-md shadow-purple-400/20 hover:shadow-purple-400/30'
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
