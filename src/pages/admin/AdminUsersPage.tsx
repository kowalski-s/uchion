import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAdminUsers, formatProviderName, formatRoleName, formatDate, type FetchAdminUsersOptions } from '../../lib/admin-api'

type StatusFilter = 'active' | 'blocked' | 'all'

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

function EyeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

export default function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const limit = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, search, statusFilter],
    queryFn: () => fetchAdminUsers({ page, limit, search, status: statusFilter }),
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

  const handleStatusChange = (status: StatusFilter) => {
    setStatusFilter(status)
    setPage(1)
  }

  if (error) {
    return (
      <div className="glass-container p-6 text-center">
        <p className="text-red-500">Ошибка загрузки пользователей</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => handleStatusChange('active')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            statusFilter === 'active'
              ? 'bg-[#8C52FF] text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Активные
        </button>
        <button
          onClick={() => handleStatusChange('blocked')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            statusFilter === 'blocked'
              ? 'bg-red-500 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Заблокированные
        </button>
        <button
          onClick={() => handleStatusChange('all')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-slate-700 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Все
        </button>
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
              placeholder="Поиск по email, имени или ID провайдера..."
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
        ) : !data?.users.length ? (
          <div className="text-center py-12">
            <p className="text-slate-500">
              {search ? 'Пользователи не найдены' : 'Нет пользователей'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Пользователь</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Статус</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Роль</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Провайдер</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Листов</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Регистрация</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${user.isBlocked ? 'bg-red-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <img
                              src={user.image}
                              alt=""
                              className={`w-10 h-10 rounded-full object-cover ${user.isBlocked ? 'opacity-50 grayscale' : ''}`}
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center ${user.isBlocked ? 'opacity-50' : ''}`}>
                              <span className="text-slate-500 font-medium text-sm">
                                {(user.name || user.email || '?')[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className={`font-medium ${user.isBlocked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                              {user.name || 'Без имени'}
                            </p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.isBlocked
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {user.isBlocked ? 'Заблокирован' : 'Активен'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {formatRoleName(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {formatProviderName(user.provider)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">
                          {user.worksheetsCount}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/users/${user.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#8C52FF] hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <EyeIcon className="w-4 h-4" />
                          Детали
                        </Link>
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
