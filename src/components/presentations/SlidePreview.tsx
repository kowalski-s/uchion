import React from 'react'
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
    <div className="flex flex-col items-center justify-center h-full px-8" style={{ background: theme.bg }}>
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: theme.accent }} />
      <h2 className="text-xl sm:text-2xl font-bold text-center leading-tight mb-3" style={{ color: theme.title }}>
        {slide.title}
      </h2>
      {slide.content.length > 0 && (
        <p className="text-sm text-center opacity-80" style={{ color: theme.text }}>
          {slide.content.join(' ')}
        </p>
      )}
    </div>
  )
}

function ContentSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col h-full px-5 pt-4" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <ul className="mt-3 space-y-1.5 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: theme.accent }} />
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
    <div className="flex flex-col h-full px-5 pt-4" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="flex gap-3 mt-3 flex-1 overflow-hidden">
        <div className="flex-1 space-y-1.5">
          {left.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs leading-relaxed">
              <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: theme.accent }} />
              <span style={{ color: theme.text }}>{item}</span>
            </div>
          ))}
        </div>
        <div className="w-px self-stretch" style={{ background: theme.accent, opacity: 0.3 }} />
        <div className="flex-1 space-y-1.5">
          {right.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs leading-relaxed">
              <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: theme.accent }} />
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
    <div className="flex flex-col h-full px-5 pt-4" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      {td && td.headers.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {td.headers.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-white font-semibold text-center" style={{ background: theme.accent }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {td.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#F8F8F8' : '#FFFFFF' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 text-center border-b border-gray-200" style={{ color: theme.text }}>
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
    <div className="flex flex-col h-full px-5 pt-4" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="mt-3 rounded-lg p-3 flex-1 overflow-hidden" style={{ background: theme.accentLight }}>
        {slide.content.map((item, i) => (
          <p key={i} className={`text-xs leading-relaxed mb-1 ${i === 0 ? 'font-semibold' : ''}`}
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
    <div className="flex flex-col h-full px-5 pt-4" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-lg font-bold text-center" style={{ color: theme.accent }}>{formula}</p>
        {explanation.length > 0 && (
          <div className="space-y-1 text-center">
            {explanation.map((line, i) => (
              <p key={i} className="text-xs" style={{ color: theme.text }}>{line}</p>
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
    <div className="flex flex-col h-full px-5 pt-4" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="flex-1 flex flex-wrap items-center justify-center gap-2 mt-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="px-3 py-2 rounded text-xs text-center font-medium border"
            style={{
              background: i === 0 ? theme.accent : '#F0F0F0',
              color: i === 0 ? '#FFFFFF' : theme.text,
              borderColor: theme.accent,
              minWidth: '80px',
              maxWidth: '140px',
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
    <div className="flex flex-col h-full px-5 pt-4" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      {hasChart ? (
        <div className="mt-3 flex-1 space-y-1.5 overflow-hidden">
          {cd!.labels.map((label, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-20 truncate text-right flex-shrink-0" style={{ color: theme.text }}>{label}</span>
              <div className="flex-1 h-4 bg-gray-100 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all"
                  style={{ width: `${(cd!.values[i] / maxVal) * 100}%`, background: theme.accent }}
                />
              </div>
              <span className="w-8 text-right font-semibold flex-shrink-0" style={{ color: theme.accent }}>
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
    <div className="flex flex-col h-full px-5 pt-4" style={{ background: theme.bg }}>
      <SlideHeader title={slide.title} theme={theme} />
      <div className="w-full h-px mt-1" style={{ background: theme.accent }} />
      <div className="mt-3 space-y-1.5 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <p key={i} className="text-xs leading-relaxed pl-2" style={{ color: theme.text }}>{item}</p>
        ))}
      </div>
    </div>
  )
}

function ConclusionSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col h-full px-5 pt-6" style={{ background: theme.bg }}>
      <div className="absolute top-0 left-0 right-0 h-2" style={{ background: theme.accent }} />
      <h3 className="text-lg font-bold text-center mb-4" style={{ color: theme.title }}>{slide.title}</h3>
      <div className="space-y-2 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className="flex-shrink-0 mt-0.5" style={{ color: theme.accent }}>&#10003;</span>
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
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: theme.accent }} />
      <h3 className="text-sm font-bold leading-tight" style={{ color: theme.title }}>{title}</h3>
      <div className="w-16 h-0.5 mt-1" style={{ background: theme.accent }} />
    </>
  )
}

function BulletList({ items, theme }: { items: string[]; theme: ThemeColors }) {
  return (
    <ul className="mt-3 space-y-1.5 flex-1 overflow-hidden">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
          <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: theme.accent }} />
          <span style={{ color: theme.text }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// =============================================================================
// Main component
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

interface SlidePreviewProps {
  structure: PresentationStructure
  themePreset?: PresentationThemePreset
}

export default function SlidePreview({ structure, themePreset = 'professional' }: SlidePreviewProps) {
  const theme = THEMES[themePreset]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {structure.slides.map((slide, idx) => {
        const Renderer = SLIDE_RENDERERS[slide.type] || ContentSlide
        return (
          <div
            key={idx}
            className="relative aspect-video rounded-lg shadow-md border border-gray-200 overflow-hidden"
            style={{ background: theme.bg }}
          >
            <Renderer slide={slide} theme={theme} />
            {/* Slide number badge */}
            <div
              className="absolute bottom-1.5 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ color: theme.accent, background: theme.accentLight }}
            >
              {idx + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}
