import { useSearchParams, Link } from 'react-router-dom'
import Header from '../components/Header'

function XCircleIcon({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order_id')

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50/30 to-white">
      <Header />

      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-6">
          <XCircleIcon className="w-12 h-12 text-slate-400" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Оплата отменена
        </h1>

        <p className="text-slate-600 mb-8">
          Вы отменили оплату. Деньги не были списаны.
          Вы можете попробовать снова в любое время.
        </p>

        {orderId && (
          <p className="text-sm text-slate-400 mb-8">
            Номер заказа: <span className="font-mono">{orderId}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/dashboard"
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
          >
            В личный кабинет
          </Link>
          <Link
            to="/generate"
            className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
          >
            Создать бесплатно
          </Link>
        </div>
      </main>
    </div>
  )
}
