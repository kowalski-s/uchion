import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { SUBSCRIPTION_PLANS } from '../../shared/plans'
import type { SubscriptionPlanId } from '../../shared/plans'

// ==================== ICONS ====================

function CloseIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function WarningIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
}

// ==================== HELPERS ====================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ==================== PLAN CARD ====================

interface PlanCardProps {
  planId: SubscriptionPlanId
  isCurrent: boolean
  isLoading: boolean
  onSelect: (planId: SubscriptionPlanId) => void
}

function PlanCard({ planId, isCurrent, isLoading, onSelect }: PlanCardProps) {
  const plan = SUBSCRIPTION_PLANS[planId]

  const PLAN_HIGHLIGHTS: Record<SubscriptionPlanId, string[]> = {
    free: ['5 генераций', '2 папки'],
    starter: [`${plan.generationsPerPeriod} генераций/мес`, `${plan.folders} папок`, 'Модели GPT-4.1'],
    teacher: [`${plan.generationsPerPeriod} генераций/мес`, `${plan.folders} папок`, 'Модели GPT-4.1'],
    expert: [`${plan.generationsPerPeriod} генераций/мес`, `${plan.folders} папок`, 'Модели GPT-4.1'],
  }

  const highlights = PLAN_HIGHLIGHTS[planId]

  const PLAN_COLORS: Record<SubscriptionPlanId, { gradient: string; border: string; badge: string }> = {
    free: {
      gradient: 'from-slate-50 to-white',
      border: 'border-slate-200',
      badge: 'bg-slate-100 text-slate-600',
    },
    starter: {
      gradient: 'from-purple-50/80 to-white',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-[#8C52FF]',
    },
    teacher: {
      gradient: 'from-violet-50/80 to-white',
      border: 'border-violet-300',
      badge: 'bg-violet-100 text-violet-700',
    },
    expert: {
      gradient: 'from-indigo-50/80 to-white',
      border: 'border-indigo-300',
      badge: 'bg-indigo-100 text-indigo-700',
    },
  }

  const colors = PLAN_COLORS[planId]

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-5 bg-gradient-to-b transition-all duration-200 ${colors.gradient} ${
        isCurrent
          ? `${colors.border} shadow-[0_0_16px_rgba(140,82,255,0.18)]`
          : `border-slate-100 hover:${colors.border} hover:shadow-md`
      }`}
    >
      {isCurrent && (
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm ${colors.badge}`}>
          Текущий план
        </span>
      )}

      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-500 mb-0.5">{plan.name}</p>
        {plan.price === 0 ? (
          <p className="text-2xl font-black text-slate-800">Бесплатно</p>
        ) : (
          <p className="text-2xl font-black text-slate-800">
            {plan.price} <span className="text-base font-semibold text-slate-500">₽/мес</span>
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-1.5 mb-5 flex-1">
        {highlights.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#8C52FF]/10 flex items-center justify-center">
              <CheckIcon className="w-2.5 h-2.5 text-[#8C52FF]" />
            </span>
            {item}
          </li>
        ))}
      </ul>

      {planId !== 'free' && (
        <button
          onClick={() => onSelect(planId)}
          disabled={isCurrent || isLoading}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
            isCurrent
              ? 'bg-slate-100 text-slate-400 cursor-default'
              : 'bg-gradient-to-r from-[#8C52FF] to-[#A16BFF] text-white hover:opacity-90 hover:shadow-md hover:shadow-purple-300/40 active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
              Загрузка...
            </span>
          ) : isCurrent ? (
            'Активен'
          ) : (
            'Оформить'
          )}
        </button>
      )}
    </div>
  )
}

// ==================== TABS ====================

type TabId = 'subscription' | 'topup'

// ==================== TOPUP TAB CONTENT ====================

// Pricing configuration (copied from BuyGenerationsModal for standalone use inside this modal)
const PRICE_PER_GENERATION = 20
const DISCOUNT_PACKAGES: Record<number, number> = {
  60: 990,
  120: 2190,
  200: 3790,
}
const GENERATION_STEPS = [5, 15, 30, 60, 120, 200] as const
const QUICK_PACKAGES = [
  { count: 15, price: 300 },
  { count: 30, price: 600 },
  { count: 60, price: 990 },
] as const

function getTopupPrice(count: number): number {
  if (count in DISCOUNT_PACKAGES) return DISCOUNT_PACKAGES[count]
  return count * PRICE_PER_GENERATION
}
function getTopupBasePrice(count: number): number {
  return count * PRICE_PER_GENERATION
}
function getTopupDiscount(count: number): number {
  if (!(count in DISCOUNT_PACKAGES)) return 0
  const base = getTopupBasePrice(count)
  const actual = DISCOUNT_PACKAGES[count]
  return Math.round(((base - actual) / base) * 100)
}

function TopupTabContent() {
  const [generationsCount, setGenerationsCount] = useState(15)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPrice = getTopupPrice(generationsCount)
  const basePrice = getTopupBasePrice(generationsCount)
  const discount = getTopupDiscount(generationsCount)
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

  return (
    <div>
      {/* Quick packages */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {QUICK_PACKAGES.map((pkg) => {
          const isSelected = generationsCount === pkg.count
          const pkgBasePrice = pkg.count * PRICE_PER_GENERATION
          const pkgHasDiscount = pkg.price < pkgBasePrice
          return (
            <button
              key={pkg.count}
              onClick={() => setGenerationsCount(pkg.count)}
              className={`relative flex flex-col items-center py-3.5 px-2 rounded-2xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-[#8C52FF] bg-gradient-to-b from-[#8C52FF]/10 to-[#A855F7]/5 shadow-[0_0_16px_rgba(140,82,255,0.25)]'
                  : 'border-purple-100 bg-white hover:border-[#8C52FF]/50 hover:shadow-[0_0_12px_rgba(140,82,255,0.15)]'
              }`}
            >
              {pkgHasDiscount && (
                <span
                  className="absolute -top-2.5 -right-1 px-2 py-0.5 text-white text-[10px] font-bold rounded-full leading-none shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                  style={{ background: 'linear-gradient(135deg, #A855F7, #D946EF)' }}
                >
                  -{Math.round(((pkgBasePrice - pkg.price) / pkgBasePrice) * 100)}%
                </span>
              )}
              <span className={`text-xl font-bold ${isSelected ? 'text-[#8C52FF]' : 'text-slate-800'}`}>
                {pkg.count}
              </span>
              <span className="text-[11px] text-slate-500 mb-1">генераций</span>
              {pkgHasDiscount && (
                <span className="text-[11px] text-slate-400 line-through">{pkgBasePrice} &#8381;</span>
              )}
              <span className={`text-sm font-bold ${isSelected ? 'text-[#8C52FF]' : 'text-slate-700'}`}>
                {pkg.price} &#8381;
              </span>
            </button>
          )
        })}
      </div>

      {/* Slider */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600 text-sm">Или выберите количество:</span>
          <span className="text-lg font-bold text-slate-900">{generationsCount}</span>
        </div>
        {(() => {
          const stepIndex = GENERATION_STEPS.indexOf(generationsCount as typeof GENERATION_STEPS[number])
          const currentIndex = stepIndex >= 0 ? stepIndex : 0
          const maxIndex = GENERATION_STEPS.length - 1
          const fillPercent = (currentIndex / maxIndex) * 100
          return (
            <>
              <input
                type="range"
                min={0}
                max={maxIndex}
                step={1}
                value={currentIndex}
                onChange={(e) => setGenerationsCount(GENERATION_STEPS[parseInt(e.target.value, 10)])}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #8C52FF 0%, #8C52FF ${fillPercent}%, #e2e8f0 ${fillPercent}%, #e2e8f0 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                {GENERATION_STEPS.map((step) => (
                  <span key={step}>{step}</span>
                ))}
              </div>
            </>
          )
        })()}
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
            <span className="ml-2 text-sm font-bold text-[#A855F7]">-{discount}%</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
          {error}
        </div>
      )}

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
            <span className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
            Загрузка...
          </span>
        ) : (
          'Купить генерации'
        )}
      </button>
    </div>
  )
}

// ==================== MAIN MODAL ====================

export interface SubscriptionPlansModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: TabId
}

export default function SubscriptionPlansModal({ isOpen, onClose, initialTab = 'subscription' }: SubscriptionPlansModalProps) {
  const { user, refreshAuth } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [loadingPlan, setLoadingPlan] = useState<SubscriptionPlanId | null>(null)
  const [subscribeError, setSubscribeError] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null)

  const subscription = user?.subscription
  const currentPlan = subscription?.plan ?? 'free'
  const subStatus = subscription?.status ?? 'active'
  const isPaid = currentPlan !== 'free'

  // Sync tab when initialTab changes (e.g. opened from different triggers)
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setSubscribeError(null)
      setCancelConfirm(false)
      setCancelError(null)
      setCancelSuccess(null)
    }
  }, [isOpen, initialTab])

  // Escape key + body scroll lock
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

  async function handleSelectPlan(planId: SubscriptionPlanId) {
    if (planId === 'free') return
    try {
      setLoadingPlan(planId)
      setSubscribeError(null)
      const res = await fetch('/api/billing/create-subscription-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: planId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка при создании ссылки на оплату')
      }
      const data = await res.json()
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      }
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : 'Ошибка при создании ссылки')
      void err
    } finally {
      setLoadingPlan(null)
    }
  }

  async function handleCancelSubscription() {
    if (!cancelConfirm) {
      setCancelConfirm(true)
      return
    }
    try {
      setCancelling(true)
      setCancelError(null)
      const res = await fetch('/api/billing/cancel-subscription', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка при отмене подписки')
      }
      const data = await res.json()
      setCancelSuccess(data.message || 'Подписка отменена')
      setCancelConfirm(false)
      await refreshAuth()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Ошибка при отмене подписки')
      void err
    } finally {
      setCancelling(false)
    }
  }

  if (!isOpen) return null

  const PAID_PLANS: SubscriptionPlanId[] = ['starter', 'teacher', 'expert']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-0 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <CloseIcon className="w-5 h-5 text-slate-400" />
          </button>

          <h2 className="text-2xl font-bold text-center mb-1">
            Управление <span className="text-[#8C52FF]">подпиской</span>
          </h2>
          <p className="text-center text-slate-500 text-sm mb-4">
            Выберите тариф или пополните генерации
          </p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
            <button
              onClick={() => setActiveTab('subscription')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'subscription'
                  ? 'bg-white text-[#8C52FF] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Подписка
            </button>
            <button
              onClick={() => setActiveTab('topup')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'topup'
                  ? 'bg-white text-[#8C52FF] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Пополнить генерации
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {activeTab === 'subscription' ? (
            <>
              {/* Status banners */}
              {subStatus === 'past_due' && (
                <div className="flex items-center gap-3 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                  <WarningIcon className="w-5 h-5 flex-shrink-0 text-amber-500" />
                  <span className="font-medium">Проблема с оплатой. Обновите платёжные данные, чтобы продолжить пользоваться сервисом.</span>
                </div>
              )}

              {subStatus === 'cancelled' && subscription?.currentPeriodEnd && (
                <div className="flex items-center gap-3 p-3 mb-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm">
                  <span className="font-medium">Подписка отменена. Активна до {formatDate(subscription.currentPeriodEnd)}.</span>
                </div>
              )}

              {cancelSuccess && (
                <div className="flex items-center gap-3 p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                  <CheckIcon className="w-5 h-5 flex-shrink-0 text-green-500" />
                  <span className="font-medium">{cancelSuccess}</span>
                </div>
              )}

              {/* Current plan info for paid users */}
              {isPaid && subscription && subStatus !== 'cancelled' && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-100 rounded-xl text-sm text-slate-700">
                  <span className="font-semibold text-[#8C52FF]">Ваш план: {SUBSCRIPTION_PLANS[currentPlan].name}</span>
                  {subscription.currentPeriodEnd && subStatus === 'active' && (
                    <span className="text-slate-500 ml-2">
                      — следующее списание: {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  )}
                </div>
              )}

              {/* Plan cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {PAID_PLANS.map((planId) => (
                  // eslint-disable-next-line react/jsx-key
                  <div key={planId}>
                    <PlanCard
                      planId={planId}
                      isCurrent={currentPlan === planId}
                      isLoading={loadingPlan === planId}
                      onSelect={handleSelectPlan}
                    />
                  </div>
                ))}
              </div>

              {subscribeError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                  {subscribeError}
                </div>
              )}

              {/* Cancel subscription */}
              {isPaid && subStatus !== 'cancelled' && (
                <div className="border-t border-slate-100 pt-4">
                  {cancelError && (
                    <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                      {cancelError}
                    </div>
                  )}
                  {cancelConfirm ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-slate-600 text-center">
                        Вы уверены? Подписка отменится, но останется активной до конца периода.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCancelConfirm(false)}
                          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Нет, оставить
                        </button>
                        <button
                          onClick={handleCancelSubscription}
                          disabled={cancelling}
                          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {cancelling ? 'Отменяю...' : 'Да, отменить'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <button
                        onClick={handleCancelSubscription}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors underline underline-offset-2"
                      >
                        Отменить подписку
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <TopupTabContent />
            </>
          )}
        </div>
      </div>

      {/* Slider styles */}
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
