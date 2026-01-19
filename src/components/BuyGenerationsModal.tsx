import { useState, useEffect } from 'react'

interface Product {
  code: string
  name: string
  price: number
  type: string
}

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

function BoltIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  )
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

export default function BuyGenerationsModal({ isOpen, onClose }: BuyGenerationsModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch products on mount
  useEffect(() => {
    if (isOpen) {
      fetchProducts()
    }
  }, [isOpen])

  async function fetchProducts() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/billing/products')
      if (!res.ok) throw new Error('Failed to fetch products')
      const data = await res.json()
      // Filter only generation products
      setProducts(data.products.filter((p: Product) => p.type === 'generations'))
    } catch (err) {
      setError('Не удалось загрузить продукты')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handlePurchase(productCode: string) {
    try {
      setPurchasing(productCode)
      setError(null)

      const res = await fetch('/api/billing/prodamus/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCode }),
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
      setPurchasing(null)
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
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Купить генерации</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <CloseIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200 border-t-purple-600" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={fetchProducts}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                Попробовать снова
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => {
                const isTest = product.code.includes('test')
                const generationsCount = product.name.match(/\d+/)?.[0] || '?'

                return (
                  <div
                    key={product.code}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      isTest
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-slate-200 hover:border-purple-300 bg-white'
                    }`}
                  >
                    {isTest && (
                      <span className="absolute -top-2 right-4 px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
                        ТЕСТ
                      </span>
                    )}

                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${isTest ? 'bg-emerald-100' : 'bg-purple-100'}`}>
                        <BoltIcon className={`w-6 h-6 ${isTest ? 'text-emerald-600' : 'text-purple-600'}`} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-slate-900">{generationsCount}</span>
                          <span className="text-slate-500">генераций</span>
                        </div>
                        <p className="text-sm text-slate-400">{product.name}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-bold text-slate-900">{product.price} ₽</div>
                        <button
                          onClick={() => handlePurchase(product.code)}
                          disabled={purchasing !== null}
                          className={`mt-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            purchasing === product.code
                              ? 'bg-slate-100 text-slate-400 cursor-wait'
                              : isTest
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                          }`}
                        >
                          {purchasing === product.code ? (
                            <span className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                              Загрузка...
                            </span>
                          ) : (
                            'Купить'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Info */}
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <h3 className="font-semibold text-slate-700 mb-2">Что вы получите:</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-emerald-500" />
                Мгновенное начисление генераций
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-emerald-500" />
                Генерации не сгорают
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-emerald-500" />
                Безопасная оплата через Prodamus
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
