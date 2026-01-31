import React, { useState, useCallback, useEffect } from 'react'
import type { PresentationStructure, PresentationSlide, PresentationThemePreset } from '../../../shared/types'

// =============================================================================
// Theme colors (mirrors PPTX generator themes)
// =============================================================================

interface ThemeColors {
  bg: string
  title: string
  text: string
  accent: string
  accentLight: string
}

const THEMES: Record<PresentationThemePreset, ThemeColors> = {
  professional: {
    bg: '#FFFFFF',
    title: '#1B2A4A',
    text: '#333333',
    accent: '#2E5090',
    accentLight: '#E8EDF5',
  },
  educational: {
    bg: '#FFFBF5',
    title: '#8C52FF',
    text: '#2D2D2D',
    accent: '#FF6B35',
    accentLight: '#FFF0E8',
  },
  minimal: {
    bg: '#FFFFFF',
    title: '#1A1A1A',
    text: '#444444',
    accent: '#999999',
    accentLight: '#F3F3F3',
  },
  scientific: {
    bg: '#F8FAF8',
    title: '#1A5632',
    text: '#2C2C2C',
    accent: '#2A7B4F',
    accentLight: '#E8F5EE',
  },
}

// =============================================================================
// Slide type renderers
// =============================================================================

function TitleSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-12" style={{ background: theme.bg }}>
      <div className="absolute top-0 left-0 right-0 h-2" style={{ background: theme.accent }} />
      <h2 className="text-3xl sm:text-4xl font-bold text-center leading-tight mb-4" style={{ color: theme.title }}>
        {slide.title}
      </h2>
      {slide.content.length > 0 && (
        <p className="text-base text-center opacity-80 max-w-lg" style={{ color: theme.text }}>
          {slide.content.join(' ')}
        </p>
      )}
    </div>
  )
}

function ContentSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col h-full px-10 pt-8" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <ul className="mt-5 space-y-3 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-relaxed">
            <span className="mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: theme.accent }} />
            <span style={{ color: theme.text }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TwoColumnSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  const left = slide.leftColumn || []
  const right = slide.rightColumn || []
  return (
    <div className="flex flex-col h-full px-10 pt-8" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="flex gap-6 mt-5 flex-1 overflow-hidden">
        <div className="flex-1 space-y-3">
          {left.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-base leading-relaxed">
              <span className="mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: theme.accent }} />
              <span style={{ color: theme.text }}>{item}</span>
            </div>
          ))}
        </div>
        <div className="w-px self-stretch" style={{ background: theme.accent, opacity: 0.3 }} />
        <div className="flex-1 space-y-3">
          {right.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-base leading-relaxed">
              <span className="mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: theme.accent }} />
              <span style={{ color: theme.text }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TableSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  const td = slide.tableData
  return (
    <div className="flex flex-col h-full px-10 pt-8" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      {td && td.headers.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-lg text-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {td.headers.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-white font-semibold text-center" style={{ background: theme.accent }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {td.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#F8F8F8' : '#FFFFFF' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2 text-center border-b border-gray-200" style={{ color: theme.text }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <BulletList items={slide.content} theme={theme} />
      )}
    </div>
  )
}

function ExampleSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col h-full px-10 pt-8" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="mt-5 rounded-xl p-6 flex-1 overflow-hidden" style={{ background: theme.accentLight }}>
        {slide.content.map((item, i) => (
          <p key={i} className={`text-base leading-relaxed mb-2 ${i === 0 ? 'font-semibold' : ''}`}
            style={{ color: i === 0 ? theme.title : theme.text }}>
            {item}
          </p>
        ))}
      </div>
    </div>
  )
}

function FormulaSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  const formula = slide.content[0] || ''
  const explanation = slide.content.slice(1)
  return (
    <div className="flex flex-col h-full px-10 pt-8" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <p className="text-2xl font-bold text-center" style={{ color: theme.accent }}>{formula}</p>
        {explanation.length > 0 && (
          <div className="space-y-2 text-center">
            {explanation.map((line, i) => (
              <p key={i} className="text-base" style={{ color: theme.text }}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DiagramSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  const items = slide.content.slice(0, 6)
  return (
    <div className="flex flex-col h-full px-10 pt-8" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="flex-1 flex flex-wrap items-center justify-center gap-4 mt-4">
        {items.map((item, i) => (
          <div
            key={i}
            className="px-5 py-3 rounded-lg text-sm text-center font-medium border"
            style={{
              background: i === 0 ? theme.accent : '#F0F0F0',
              color: i === 0 ? '#FFFFFF' : theme.text,
              borderColor: theme.accent,
              minWidth: '120px',
              maxWidth: '200px',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  const cd = slide.chartData
  const hasChart = cd && cd.labels.length > 0 && cd.values.length > 0
  const maxVal = hasChart ? Math.max(...cd!.values, 1) : 1

  return (
    <div className="flex flex-col h-full px-10 pt-8" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      {hasChart ? (
        <div className="mt-5 flex-1 space-y-3 overflow-hidden">
          {cd!.labels.map((label, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="w-28 truncate text-right flex-shrink-0" style={{ color: theme.text }}>{label}</span>
              <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${(cd!.values[i] / maxVal) * 100}%`, background: theme.accent }}
                />
              </div>
              <span className="w-10 text-right font-semibold flex-shrink-0" style={{ color: theme.accent }}>
                {cd!.values[i]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <BulletList items={slide.content} theme={theme} />
      )}
    </div>
  )
}

function PracticeSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col h-full px-10 pt-8" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="w-full h-px mt-2" style={{ background: theme.accent }} />
      <div className="mt-5 space-y-3 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <p key={i} className="text-base leading-relaxed pl-3" style={{ color: theme.text }}>{item}</p>
        ))}
      </div>
    </div>
  )
}

function ConclusionSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col h-full px-10 pt-10" style={{ background: theme.bg }}>
      <div className="absolute top-0 left-0 right-0 h-3" style={{ background: theme.accent }} />
      <h3 className="text-2xl font-bold text-center mb-6" style={{ color: theme.title }}>{slide.title}</h3>
      <div className="space-y-3 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <div key={i} className="flex items-start gap-3 text-base leading-relaxed">
            <span className="flex-shrink-0 mt-0.5 text-lg" style={{ color: theme.accent }}>&#10003;</span>
            <span style={{ color: theme.text }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Shared sub-components
// =============================================================================

function SlideHeader({ title, theme }: { title: string; theme: ThemeColors }) {
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: theme.accent }} />
      <h3 className="text-xl font-bold leading-tight" style={{ color: theme.title }}>{title}</h3>
      <div className="w-20 h-0.5 mt-2" style={{ background: theme.accent }} />
    </>
  )
}

function BulletList({ items, theme }: { items: string[]; theme: ThemeColors }) {
  return (
    <ul className="mt-5 space-y-3 flex-1 overflow-hidden">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-base leading-relaxed">
          <span className="mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: theme.accent }} />
          <span style={{ color: theme.text }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// =============================================================================
// Slide renderers map
// =============================================================================

type SlideRendererProps = { slide: PresentationSlide; theme: ThemeColors }
type SlideRenderer = (props: SlideRendererProps) => React.JSX.Element

const SLIDE_RENDERERS: Record<PresentationSlide['type'], SlideRenderer> = {
  title: TitleSlide,
  content: ContentSlide,
  twoColumn: TwoColumnSlide,
  table: TableSlide,
  example: ExampleSlide,
  formula: FormulaSlide,
  diagram: DiagramSlide,
  chart: ChartSlide,
  practice: PracticeSlide,
  conclusion: ConclusionSlide,
}

// =============================================================================
// Navigation arrow button
// =============================================================================

function NavButton({ direction, onClick, disabled }: { direction: 'prev' | 'next'; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`absolute top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-white/90 shadow-lg border border-gray-200 transition-all hover:bg-white hover:shadow-xl disabled:opacity-30 disabled:cursor-not-allowed ${
        direction === 'prev' ? 'left-2 sm:left-4' : 'right-2 sm:right-4'
      }`}
      aria-label={direction === 'prev' ? 'Previous slide' : 'Next slide'}
    >
      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {direction === 'prev' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        )}
      </svg>
    </button>
  )
}

// =============================================================================
// Main component -- Presentation Viewer
// =============================================================================

interface SlidePreviewProps {
  structure: PresentationStructure
  themePreset?: PresentationThemePreset
}

export default function SlidePreview({ structure, themePreset = 'professional' }: SlidePreviewProps) {
  const theme = THEMES[themePreset]
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = structure.slides.length

  const goTo = useCallback((idx: number) => {
    setCurrentSlide(Math.max(0, Math.min(idx, totalSlides - 1)))
  }, [totalSlides])

  const goPrev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo])
  const goNext = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goPrev, goNext])

  const slide = structure.slides[currentSlide]
  const Renderer = SLIDE_RENDERERS[slide.type] || ContentSlide

  return (
    <div className="w-full space-y-4">
      {/* Main slide viewer */}
      <div className="relative w-full rounded-2xl shadow-xl border border-gray-200 overflow-hidden bg-gray-900">
        {/* Slide area -- 16:9 aspect ratio */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ background: theme.bg }}
          >
            <Renderer slide={slide} theme={theme} />
            {/* Slide number */}
            <div
              className="absolute bottom-3 right-4 text-xs font-medium px-2 py-1 rounded"
              style={{ color: theme.accent, background: theme.accentLight }}
            >
              {currentSlide + 1} / {totalSlides}
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        <NavButton direction="prev" onClick={goPrev} disabled={currentSlide === 0} />
        <NavButton direction="next" onClick={goNext} disabled={currentSlide === totalSlides - 1} />
      </div>

      {/* Slide counter + keyboard hint */}
      <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
        <span>
          {currentSlide + 1} / {totalSlides}
        </span>
        <span className="hidden sm:inline text-slate-300">|</span>
        <span className="hidden sm:inline">
          Используйте стрелки для навигации
        </span>
      </div>

      {/* Thumbnail strip */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin">
          {structure.slides.map((s, idx) => {
            const ThumbRenderer = SLIDE_RENDERERS[s.type] || ContentSlide
            return (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={`relative flex-shrink-0 w-32 sm:w-40 rounded-lg overflow-hidden border-2 transition-all hover:shadow-md ${
                  idx === currentSlide
                    ? 'border-[#8C52FF] shadow-md ring-2 ring-[#8C52FF]/20'
                    : 'border-gray-200 opacity-70 hover:opacity-100'
                }`}
                style={{ aspectRatio: '16/9' }}
              >
                <div className="absolute inset-0 overflow-hidden" style={{ background: theme.bg }}>
                  {/* Scale down the slide content for thumbnail */}
                  <div className="w-[300%] h-[300%] origin-top-left" style={{ transform: 'scale(0.333)' }}>
                    <div className="relative w-full h-full">
                      <ThumbRenderer slide={s} theme={theme} />
                    </div>
                  </div>
                </div>
                {/* Slide number overlay */}
                <div className="absolute bottom-0.5 right-1 text-[9px] font-semibold px-1 rounded bg-black/40 text-white">
                  {idx + 1}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
