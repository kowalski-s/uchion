import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Header from '../components/Header'

function CheckCircleIcon({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

interface PaymentStatus {
  status: string
  productName: string
  paidAt: string | null
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order_id')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      checkPaymentStatus()
    } else {
      setLoading(false)
    }
  }, [orderId])

  async function checkPaymentStatus() {
    try {
      const res = await fetch(`/api/billing/payment-status/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setPaymentStatus(data)
      }
    } catch (err) {
      console.error('Failed to check payment status:', err)
      setError('Не удалось проверить статус платежа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-emerald-50/30 to-white">
      <Header />

      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6">
              <CheckCircleIcon className="w-12 h-12 text-emerald-600" />
            </div>

            <h1 className="text-3xl font-bold text-slate-900 mb-3">
              Оплата прошла успешно!
            </h1>

            {paymentStatus?.status === 'paid' ? (
              <p className="text-slate-600 mb-8">
                {paymentStatus.productName} успешно добавлены в ваш аккаунт.
              </p>
            ) : (
              <p className="text-slate-600 mb-8">
                Генерации будут начислены в течение нескольких минут.
                Если этого не произошло, обратитесь в поддержку.
              </p>
            )}

            {orderId && (
              <p className="text-sm text-slate-400 mb-8">
                Номер заказа: <span className="font-mono">{orderId}</span>
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/dashboard"
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
              >
                Перейти в кабинет
              </Link>
              <Link
                to="/generate"
                className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
              >
                Создать лист
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
