import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAICostsSummary, fetchAICostsDaily } from '../../lib/admin-api'
import type { AICostsSummary } from '../../lib/admin-api'

type Period = 'today' | 'week' | 'month' | 'all'

const CALL_TYPE_NAMES: Record<string, string> = {
  'new-generation': 'Генерация',
  'regenerate-task': 'Перегенерация',
  'retry': 'Retry (догенерация)',
  'verifier': 'Верификатор',
  'content_checker': 'Проверка контента',
  'quality_checker': 'Проверка качества',
  'fixer': 'Фиксер',
  'presentation': 'Презентация',
  'validator': 'Валидатор',
  'regen-problem-blocks': 'Регенерация блоков',
}

function formatRubles(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20BD'
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K'
  return String(value)
}

function shortModelName(model: string): string {
  return model.replace(/^(openai|google|deepseek|anthropic)\//, '')
}

export default function AdminAICostsPage() {
  const [period, setPeriod] = useState<Period>('month')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['admin-ai-costs-summary', period],
    queryFn: () => fetchAICostsSummary(period),
    staleTime: 60 * 1000,
  })

  const { data: todaySummary } = useQuery({
    queryKey: ['admin-ai-costs-summary', 'today'],
    queryFn: () => fetchAICostsSummary('today'),
    staleTime: 60 * 1000,
  })

  const { data: weekSummary } = useQuery({
    queryKey: ['admin-ai-costs-summary', 'week'],
    queryFn: () => fetchAICostsSummary('week'),
    staleTime: 60 * 1000,
  })

  const { data: monthSummary } = useQuery({
    queryKey: ['admin-ai-costs-summary', 'month'],
    queryFn: () => fetchAICostsSummary('month'),
    staleTime: 60 * 1000,
  })

  const { data: dailyData } = useQuery({
    queryKey: ['admin-ai-costs-daily'],
    queryFn: () => fetchAICostsDaily(30),
    staleTime: 60 * 1000,
  })

  if (summaryLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="relative">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-200"></div>
          <div className="absolute inset-0 animate-spin rounded-full h-8 w-8 border-t-2 border-[#8C52FF]"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CostCard label="Сегодня" value={todaySummary?.totalCostRubles ?? 0} calls={todaySummary?.totalCalls ?? 0} />
        <CostCard label="За неделю" value={weekSummary?.totalCostRubles ?? 0} calls={weekSummary?.totalCalls ?? 0} />
        <CostCard label="За месяц" value={monthSummary?.totalCostRubles ?? 0} calls={monthSummary?.totalCalls ?? 0} />
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['today', 'week', 'month', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? 'bg-[#8C52FF] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {{ today: 'Сегодня', week: 'Неделя', month: 'Месяц', all: 'Все' }[p]}
          </button>
        ))}
      </div>

      {/* By Model Table */}
      {summary && summary.costByModel.length > 0 && (
        <div className="glass-container p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">По моделям</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Модель</th>
                  <th className="text-right py-2 px-4 text-slate-500 font-medium">Вызовы</th>
                  <th className="text-right py-2 px-4 text-slate-500 font-medium">Input</th>
                  <th className="text-right py-2 px-4 text-slate-500 font-medium">Output</th>
                  <th className="text-right py-2 pl-4 text-slate-500 font-medium">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {summary.costByModel.map((row) => (
                  <tr key={row.model} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-700">{shortModelName(row.model)}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{row.calls}</td>
                    <td className="py-2.5 px-4 text-right text-slate-500">{formatTokens(row.promptTokens)}</td>
                    <td className="py-2.5 px-4 text-right text-slate-500">{formatTokens(row.completionTokens)}</td>
                    <td className="py-2.5 pl-4 text-right font-medium text-slate-900">{formatRubles(row.costRubles)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300">
                  <td className="py-2.5 pr-4 font-medium text-slate-900">Итого</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">{summary.totalCalls}</td>
                  <td className="py-2.5 px-4 text-right text-slate-500">{formatTokens(summary.totalPromptTokens)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-500">{formatTokens(summary.totalCompletionTokens)}</td>
                  <td className="py-2.5 pl-4 text-right font-bold text-slate-900">{formatRubles(summary.totalCostRubles)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* By Call Type Table */}
      {summary && summary.costByCallType.length > 0 && (
        <div className="glass-container p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">По типу вызова</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Тип</th>
                  <th className="text-right py-2 px-4 text-slate-500 font-medium">Вызовы</th>
                  <th className="text-right py-2 pl-4 text-slate-500 font-medium">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {summary.costByCallType.map((row) => (
                  <tr key={row.callType} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 text-slate-700">{CALL_TYPE_NAMES[row.callType] || row.callType}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{row.calls}</td>
                    <td className="py-2.5 pl-4 text-right font-medium text-slate-900">{formatRubles(row.costRubles)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Chart (CSS bars) */}
      {dailyData && dailyData.daily.length > 0 && (
        <div className="glass-container p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">По дням (30 дней)</h2>
          <DailyChart data={dailyData.daily} />
        </div>
      )}

      {/* Empty state */}
      {summary && summary.totalCalls === 0 && (
        <div className="glass-container p-12 text-center">
          <p className="text-slate-500 text-lg">Нет данных о расходах AI за выбранный период</p>
          <p className="text-slate-400 text-sm mt-2">Данные появятся после первой генерации с включённым AI-провайдером</p>
        </div>
      )}
    </div>
  )
}

function CostCard({ label, value, calls }: { label: string; value: number; calls: number }) {
  return (
    <div className="glass-container p-5">
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{formatRubles(value)}</div>
      <div className="text-xs text-slate-400 mt-1">{calls} вызовов</div>
    </div>
  )
}

function DailyChart({ data }: { data: { date: string; costRubles: number; calls: number }[] }) {
  const maxCost = Math.max(...data.map(d => d.costRubles), 1)

  return (
    <div className="flex items-end gap-1" style={{ height: 160 }}>
      {data.map((d) => {
        const height = Math.max((d.costRubles / maxCost) * 140, 2)
        const dateStr = new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
        return (
          <div
            key={d.date}
            className="flex-1 group relative flex flex-col items-center justify-end"
            style={{ minWidth: 0 }}
          >
            <div
              className="w-full bg-[#8C52FF]/70 hover:bg-[#8C52FF] rounded-t transition-colors cursor-default"
              style={{ height }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
              <div className="bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                {dateStr}: {formatRubles(d.costRubles)} ({d.calls})
              </div>
            </div>
            {/* Date label -- show every ~5th */}
            {data.length <= 14 || data.indexOf(d) % Math.ceil(data.length / 7) === 0 ? (
              <div className="text-[10px] text-slate-400 mt-1 truncate w-full text-center">{dateStr}</div>
            ) : (
              <div className="h-[14px] mt-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}
