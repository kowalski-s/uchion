import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchAdminPayments,
  formatPaymentStatus,
  formatAmount,
  formatDateTime,
  type PaymentStatusFilter,
} from '../../lib/admin-api'

// Icon components
function SearchIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

function ChevronLeftIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function CurrencyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
    </svg>
  )
}

const statusTabs: { value: PaymentStatusFilter; label: string; color: string }[] = [
  { value: 'all', label: 'Все', color: 'bg-slate-700' },
  { value: 'succeeded', label: 'Успешные', color: 'bg-emerald-500' },
  { value: 'pending', label: 'Ожидание', color: 'bg-amber-500' },
  { value: 'failed', label: 'Ошибки', color: 'bg-red-500' },
  { value: 'refunded', label: 'Возвраты', color: 'bg-purple-500' },
]

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-700'
    case 'pending':
      return 'bg-amber-100 text-amber-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    case 'refunded':
      return 'bg-purple-100 text-purple-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export default function AdminPaymentsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all')
  const limit = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-payments', page, search, statusFilter],
    queryFn: () => fetchAdminPayments({ page, limit, search, status: statusFilter }),
    staleTime: 30 * 1000,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const handleStatusChange = (status: PaymentStatusFilter) => {
    setStatusFilter(status)
    setPage(1)
  }

  // Calculate totals for current filter
  const totals = data?.payments.reduce(
    (acc, payment) => {
      if (payment.status === 'succeeded') {
        acc.succeeded += payment.amount
      }
      acc.total += payment.amount
      return acc
    },
    { total: 0, succeeded: 0 }
  ) || { total: 0, succeeded: 0 }

  if (error) {
    return (
      <div className="glass-container p-6 text-center">
        <p className="text-red-500">Ошибка загрузки платежей</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {data && data.payments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-container p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CurrencyIcon className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Успешных на странице</p>
              <p className="text-xl font-bold text-emerald-600">
                {formatAmount(totals.succeeded)}
              </p>
            </div>
          </div>
          <div className="glass-container p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <CurrencyIcon className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Всего платежей</p>
              <p className="text-xl font-bold text-slate-700">
                {data.pagination.total}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              statusFilter === tab.value
                ? `${tab.color} text-white`
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="glass-container p-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по email пользователя..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8C52FF]/20 focus:border-[#8C52FF]"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#8C52FF] text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
          >
            Найти
          </button>
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              Сбросить
            </button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="glass-container overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="relative">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200"></div>
              <div className="absolute inset-0 animate-spin rounded-full h-8 w-8 border-t-2 border-[#8C52FF]"></div>
            </div>
          </div>
        ) : !data?.payments.length ? (
          <div className="text-center py-12">
            <div className="mb-4">
              <CurrencyIcon className="w-12 h-12 text-slate-300 mx-auto" />
            </div>
            <p className="text-slate-500">
              {search || statusFilter !== 'all' ? 'Платежи не найдены' : 'Нет платежей'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Платежи появятся после интеграции с платёжной системой
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Дата</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Пользователь</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Статус</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Сумма</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">ID платежа</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 ${
                        payment.status === 'failed' ? 'bg-red-50/30' :
                        payment.status === 'refunded' ? 'bg-purple-50/30' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {formatDateTime(payment.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/admin/users/${payment.userId}`}
                          className="text-sm font-medium text-[#8C52FF] hover:underline"
                        >
                          {payment.userEmail || 'Неизвестно'}
                        </Link>
                        {payment.userName && (
                          <p className="text-xs text-slate-500">{payment.userName}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeStyle(payment.status)}`}>
                          {formatPaymentStatus(payment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-sm font-semibold ${
                          payment.status === 'succeeded' ? 'text-emerald-600' :
                          payment.status === 'refunded' ? 'text-purple-600' :
                          payment.status === 'failed' ? 'text-red-500' :
                          'text-slate-700'
                        }`}>
                          {payment.status === 'refunded' ? '-' : ''}{formatAmount(payment.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500 font-mono">
                          {payment.providerPaymentId || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  Показано {(page - 1) * limit + 1}-{Math.min(page * limit, data.pagination.total)} из {data.pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeftIcon className="w-5 h-5 text-slate-600" />
                  </button>
                  <span className="px-3 py-1 text-sm font-medium text-slate-600">
                    {page} / {data.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRightIcon className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
