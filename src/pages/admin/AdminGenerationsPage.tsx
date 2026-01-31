import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchAdminGenerations,
  fetchGenerationLogs,
  formatSubjectName,
  formatDifficulty,
  formatGenerationStatus,
  formatDateTime,
  type SubjectFilter,
  type GenerationLogStatusFilter,
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

function DocumentIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function ClipboardDocumentListIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  )
}

function ExclamationTriangleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
}

type ViewMode = 'worksheets' | 'logs'

const subjectTabs: { value: SubjectFilter; label: string; color: string }[] = [
  { value: 'all', label: 'Все предметы', color: 'bg-slate-700' },
  { value: 'math', label: 'Математика', color: 'bg-blue-500' },
  { value: 'algebra', label: 'Алгебра', color: 'bg-indigo-500' },
  { value: 'geometry', label: 'Геометрия', color: 'bg-violet-500' },
  { value: 'russian', label: 'Русский язык', color: 'bg-emerald-500' },
]

const logStatusTabs: { value: GenerationLogStatusFilter; label: string; color: string }[] = [
  { value: 'all', label: 'Все', color: 'bg-slate-700' },
  { value: 'completed', label: 'Успешные', color: 'bg-emerald-500' },
  { value: 'processing', label: 'В процессе', color: 'bg-blue-500' },
  { value: 'pending', label: 'Ожидание', color: 'bg-amber-500' },
  { value: 'failed', label: 'Ошибки', color: 'bg-red-500' },
]

function getSubjectBadgeStyle(subject: string) {
  switch (subject) {
    case 'math':
      return 'bg-blue-100 text-blue-700'
    case 'russian':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function getDifficultyBadgeStyle(difficulty: string) {
  switch (difficulty) {
    case 'easy':
      return 'bg-green-100 text-green-700'
    case 'medium':
      return 'bg-amber-100 text-amber-700'
    case 'hard':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function getLogStatusBadgeStyle(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700'
    case 'processing':
      return 'bg-blue-100 text-blue-700'
    case 'pending':
      return 'bg-amber-100 text-amber-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export default function AdminGenerationsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('worksheets')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>('all')
  const [logStatusFilter, setLogStatusFilter] = useState<GenerationLogStatusFilter>('all')
  const [expandedError, setExpandedError] = useState<string | null>(null)
  const limit = 20

  // Query for worksheets
  const worksheetsQuery = useQuery({
    queryKey: ['admin-generations', page, search, subjectFilter],
    queryFn: () => fetchAdminGenerations({ page, limit, search, subject: subjectFilter }),
    staleTime: 30 * 1000,
    enabled: viewMode === 'worksheets',
  })

  // Query for logs
  const logsQuery = useQuery({
    queryKey: ['admin-generation-logs', page, search, logStatusFilter],
    queryFn: () => fetchGenerationLogs({ page, limit, search, status: logStatusFilter }),
    staleTime: 30 * 1000,
    enabled: viewMode === 'logs',
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

  const handleSubjectChange = (subject: SubjectFilter) => {
    setSubjectFilter(subject)
    setPage(1)
  }

  const handleLogStatusChange = (status: GenerationLogStatusFilter) => {
    setLogStatusFilter(status)
    setPage(1)
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    setPage(1)
    setSearch('')
    setSearchInput('')
  }

  const toggleError = (id: string) => {
    setExpandedError(expandedError === id ? null : id)
  }

  const currentQuery = viewMode === 'worksheets' ? worksheetsQuery : logsQuery

  if (currentQuery.error) {
    return (
      <div className="glass-container p-6 text-center">
        <p className="text-red-500">Ошибка загрузки данных</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="glass-container p-1 inline-flex rounded-xl">
        <button
          onClick={() => handleViewModeChange('worksheets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'worksheets'
              ? 'bg-[#8C52FF] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DocumentIcon className="w-5 h-5" />
          Листы
        </button>
        <button
          onClick={() => handleViewModeChange('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'logs'
              ? 'bg-[#8C52FF] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardDocumentListIcon className="w-5 h-5" />
          Логи
        </button>
      </div>

      {/* Worksheets View */}
      {viewMode === 'worksheets' && (
        <>
          {/* Summary */}
          {worksheetsQuery.data && (
            <div className="glass-container p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <DocumentIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Всего листов</p>
                <p className="text-xl font-bold text-slate-700">
                  {worksheetsQuery.data.pagination.total}
                </p>
              </div>
            </div>
          )}

          {/* Subject Tabs */}
          <div className="flex flex-wrap gap-2">
            {subjectTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleSubjectChange(tab.value)}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  subjectFilter === tab.value
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
                  placeholder="Поиск по email пользователя или теме..."
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

          {/* Worksheets Table */}
          <div className="glass-container overflow-hidden">
            {worksheetsQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <div className="relative">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200"></div>
                  <div className="absolute inset-0 animate-spin rounded-full h-8 w-8 border-t-2 border-[#8C52FF]"></div>
                </div>
              </div>
            ) : !worksheetsQuery.data?.generations.length ? (
              <div className="text-center py-12">
                <div className="mb-4">
                  <DocumentIcon className="w-12 h-12 text-slate-300 mx-auto" />
                </div>
                <p className="text-slate-500">
                  {search || subjectFilter !== 'all' ? 'Листы не найдены' : 'Нет сгенерированных листов'}
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
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Предмет</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Класс</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Тема</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Сложность</th>
                      </tr>
                    </thead>
                    <tbody>
                      {worksheetsQuery.data.generations.map((gen) => (
                        <tr key={gen.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">
                              {formatDateTime(gen.createdAt)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              to={`/admin/users/${gen.userId}`}
                              className="text-sm font-medium text-[#8C52FF] hover:underline"
                            >
                              {gen.userEmail || 'Неизвестно'}
                            </Link>
                            {gen.userName && (
                              <p className="text-xs text-slate-500">{gen.userName}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSubjectBadgeStyle(gen.subject)}`}>
                              {formatSubjectName(gen.subject)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-slate-700">
                              {gen.grade} класс
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600 max-w-[250px] truncate block" title={gen.title || gen.topic}>
                              {gen.title || gen.topic}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getDifficultyBadgeStyle(gen.difficulty)}`}>
                              {formatDifficulty(gen.difficulty)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {worksheetsQuery.data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                    <p className="text-sm text-slate-500">
                      Показано {(page - 1) * limit + 1}-{Math.min(page * limit, worksheetsQuery.data.pagination.total)} из {worksheetsQuery.data.pagination.total}
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
                        {page} / {worksheetsQuery.data.pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(worksheetsQuery.data!.pagination.totalPages, p + 1))}
                        disabled={page === worksheetsQuery.data.pagination.totalPages}
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
        </>
      )}

      {/* Logs View */}
      {viewMode === 'logs' && (
        <>
          {/* Summary */}
          {logsQuery.data && (
            <div className="glass-container p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                <ClipboardDocumentListIcon className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Всего записей в логе</p>
                <p className="text-xl font-bold text-slate-700">
                  {logsQuery.data.pagination.total}
                </p>
              </div>
            </div>
          )}

          {/* Status Tabs */}
          <div className="flex flex-wrap gap-2">
            {logStatusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleLogStatusChange(tab.value)}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  logStatusFilter === tab.value
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

          {/* Logs Table */}
          <div className="glass-container overflow-hidden">
            {logsQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <div className="relative">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200"></div>
                  <div className="absolute inset-0 animate-spin rounded-full h-8 w-8 border-t-2 border-[#8C52FF]"></div>
                </div>
              </div>
            ) : !logsQuery.data?.logs.length ? (
              <div className="text-center py-12">
                <div className="mb-4">
                  <ClipboardDocumentListIcon className="w-12 h-12 text-slate-300 mx-auto" />
                </div>
                <p className="text-slate-500">
                  {search || logStatusFilter !== 'all' ? 'Логи не найдены' : 'Нет записей в логе'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Логи появятся после генерации листов
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
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Предмет</th>
                        <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Тема</th>
                        <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">Ошибка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsQuery.data.logs.map((log) => (
                        <React.Fragment key={log.id}>
                          <tr className={`border-b border-slate-100 hover:bg-slate-50/50 ${log.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-600">
                                {formatDateTime(log.createdAt)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <Link
                                to={`/admin/users/${log.userId}`}
                                className="text-sm font-medium text-[#8C52FF] hover:underline"
                              >
                                {log.userEmail || 'Неизвестно'}
                              </Link>
                              {log.userName && (
                                <p className="text-xs text-slate-500">{log.userName}</p>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getLogStatusBadgeStyle(log.status)}`}>
                                {formatGenerationStatus(log.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-600">
                                {log.worksheetSubject ? formatSubjectName(log.worksheetSubject) : '—'}
                              </span>
                              {log.worksheetGrade && (
                                <p className="text-xs text-slate-500">{log.worksheetGrade} класс</p>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-600 max-w-[200px] truncate block" title={log.worksheetTopic || undefined}>
                                {log.worksheetTopic || '—'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {log.errorMessage ? (
                                <button
                                  onClick={() => toggleError(log.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Показать ошибку"
                                >
                                  <ExclamationTriangleIcon className="w-5 h-5" />
                                  <span className="text-xs font-medium">Детали</span>
                                </button>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                          {expandedError === log.id && log.errorMessage && (
                            <tr className="bg-red-50">
                              <td colSpan={6} className="px-6 py-4">
                                <div className="text-sm text-red-700 font-mono whitespace-pre-wrap break-all">
                                  {log.errorMessage}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsQuery.data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                    <p className="text-sm text-slate-500">
                      Показано {(page - 1) * limit + 1}-{Math.min(page * limit, logsQuery.data.pagination.total)} из {logsQuery.data.pagination.total}
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
                        {page} / {logsQuery.data.pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(logsQuery.data!.pagination.totalPages, p + 1))}
                        disabled={page === logsQuery.data.pagination.totalPages}
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
        </>
      )}
    </div>
  )
}
