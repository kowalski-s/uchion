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
  // Minimalism-specific
  dark?: string
  muted?: string
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
    bg: '#F5F3F0',
    title: '#1A1A1A',
    text: '#2D2D2D',
    accent: '#8B7355',
    accentLight: '#E8E4DF',
    dark: '#1A1A1A',
    muted: '#6B6B6B',
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
// Minimalism slide renderers
// =============================================================================

function MinTitleSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  const category = slide.content[0] || ''
  const subtitle = slide.content[1] || ''
  const footer = slide.content[2] || ''
  return (
    <div className="relative flex h-full" style={{ background: theme.dark }}>
      {/* Left content */}
      <div className="flex-1 flex flex-col justify-center pl-10 pr-6">
        {/* Accent vertical line */}
        <div className="absolute left-8 top-[15%] bottom-[15%] w-0.5" style={{ background: theme.accent }} />
        {category && (
          <p className="text-xs font-bold tracking-[0.25em] mb-3 pl-4" style={{ color: theme.accent }}>
            {category.toUpperCase()}
          </p>
        )}
        <h2 className="text-3xl font-bold leading-tight pl-4" style={{ fontFamily: 'Georgia, serif', color: '#FFFFFF' }}>
          {slide.title}
        </h2>
        {subtitle && (
          <p className="text-base mt-4 pl-4" style={{ color: theme.muted }}>{subtitle}</p>
        )}
        {footer && (
          <p className="text-xs mt-auto mb-4 pl-4" style={{ color: theme.muted }}>{footer}</p>
        )}
      </div>
      {/* Decorative blocks right */}
      <div className="w-[30%] relative mr-4 my-6">
        <div className="absolute inset-0 rounded-sm" style={{ background: theme.accentLight }} />
        <div className="absolute top-[10%] left-[15%] right-[5%] bottom-[20%] rounded-sm" style={{ background: '#FFFFFF' }} />
      </div>
    </div>
  )
}

function MinContentSlide({ slide, theme, index, total }: { slide: PresentationSlide; theme: ThemeColors; index: number; total: number }) {
  const sectionNum = getSectionNum(index, total)
  return (
    <div className="flex flex-col h-full px-10 pt-7" style={{ background: theme.bg }}>
      {sectionNum && (
        <span className="text-xs font-bold mb-1" style={{ color: theme.accent }}>{sectionNum}</span>
      )}
      <h3 className="text-xl font-bold leading-tight" style={{ fontFamily: 'Georgia, serif', color: theme.title }}>
        {slide.title}
      </h3>
      <div className="w-20 h-0.5 mt-2 mb-4" style={{ background: theme.accent }} />
      <ul className="space-y-2.5 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
            <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full" style={{ background: theme.accent }} />
            <span style={{ color: theme.text }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MinTwoColumnSlide({ slide, theme, index, total }: { slide: PresentationSlide; theme: ThemeColors; index: number; total: number }) {
  const sectionNum = getSectionNum(index, total)
  const left = slide.leftColumn || []
  const right = slide.rightColumn || []
  const allItems = [...left, ...right]

  return (
    <div className="relative flex h-full" style={{ background: theme.bg }}>
      {/* Dark left panel */}
      <div className="w-[42%] flex flex-col justify-between p-7" style={{ background: theme.dark }}>
        {sectionNum && (
          <span className="text-xs font-bold" style={{ color: theme.accent }}>{sectionNum}</span>
        )}
        <h3 className="text-2xl font-bold leading-snug mt-2" style={{ fontFamily: 'Georgia, serif', color: '#FFFFFF' }}>
          {slide.title}
        </h3>
        <span className="text-[10px] mt-auto" style={{ color: theme.muted }}>
          {slide.content[0] || ''}
        </span>
      </div>
      {/* Right panel with cards */}
      <div className="flex-1 p-6 space-y-2.5 overflow-hidden">
        {allItems.length > 0 ? allItems.map((item, i) => (
          <div key={i} className="flex items-center rounded-sm px-3 py-2.5" style={{ background: '#FFFFFF', borderLeft: `3px solid ${theme.accent}` }}>
            <span className="text-sm" style={{ color: theme.text }}>{item}</span>
          </div>
        )) : slide.content.slice(1).map((item, i) => (
          <div key={i} className="flex items-center rounded-sm px-3 py-2.5" style={{ background: '#FFFFFF', borderLeft: `3px solid ${theme.accent}` }}>
            <span className="text-sm" style={{ color: theme.text }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MinFormulaSlide({ slide, theme, index, total }: { slide: PresentationSlide; theme: ThemeColors; index: number; total: number }) {
  const sectionNum = getSectionNum(index, total)
  const formula = slide.content[0] || ''
  const description = slide.content[1] || ''
  const legendItems = slide.content.slice(2)

  return (
    <div className="flex flex-col h-full px-10 pt-7" style={{ background: '#FFFFFF' }}>
      {sectionNum && (
        <span className="text-xs font-bold mb-1" style={{ color: theme.accent }}>{sectionNum}</span>
      )}
      <h3 className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif', color: theme.title }}>
        {slide.title}
      </h3>
      {/* Formula box */}
      <div className="mt-4 rounded-sm px-6 py-5 flex flex-col items-center" style={{ background: theme.accentLight }}>
        <p className="text-2xl font-bold text-center" style={{ fontFamily: 'Georgia, serif', color: theme.title }}>
          {formula}
        </p>
        {description && (
          <p className="text-xs mt-2 text-center" style={{ color: theme.muted }}>{description}</p>
        )}
      </div>
      {/* Legend */}
      {legendItems.length > 0 && (
        <div className="flex gap-2 mt-3">
          {legendItems.map((item, i) => (
            <div key={i} className="flex-1 rounded-sm px-3 py-2" style={{ background: theme.dark }}>
              <span className="text-xs" style={{ color: '#FFFFFF' }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MinExampleSlide({ slide, theme, index, total }: { slide: PresentationSlide; theme: ThemeColors; index: number; total: number }) {
  const sectionNum = getSectionNum(index, total)
  return (
    <div className="flex flex-col h-full px-10 pt-7" style={{ background: theme.bg }}>
      {sectionNum && (
        <span className="text-xs font-bold mb-1" style={{ color: theme.accent }}>{sectionNum}</span>
      )}
      <h3 className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif', color: theme.title }}>
        {slide.title}
      </h3>
      {/* Card with accent top border */}
      <div className="mt-4 flex-1 rounded-sm overflow-hidden" style={{ background: '#FFFFFF', borderTop: `3px solid ${theme.accent}` }}>
        <div className="p-5 space-y-2">
          {slide.content.map((item, i) => (
            <p key={i} className={`text-sm leading-relaxed ${i === 0 ? 'font-semibold' : ''}`}
              style={{ color: i === 0 ? theme.title : theme.text }}>
              {item}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

function MinPracticeSlide({ slide, theme, index, total }: { slide: PresentationSlide; theme: ThemeColors; index: number; total: number }) {
  const sectionNum = getSectionNum(index, total)
  return (
    <div className="flex flex-col h-full px-10 pt-7" style={{ background: theme.bg }}>
      {sectionNum && (
        <span className="text-xs font-bold mb-1" style={{ color: theme.accent }}>{sectionNum}</span>
      )}
      <h3 className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif', color: theme.title }}>
        {slide.title}
      </h3>
      <div className="w-full h-0.5 mt-2 mb-4" style={{ background: theme.accent }} />
      <div className="space-y-3 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <p key={i} className="text-sm leading-relaxed" style={{ color: theme.text }}>{item}</p>
        ))}
      </div>
    </div>
  )
}

function MinTableSlide({ slide, theme, index, total }: { slide: PresentationSlide; theme: ThemeColors; index: number; total: number }) {
  const sectionNum = getSectionNum(index, total)
  const td = slide.tableData
  return (
    <div className="flex flex-col h-full px-10 pt-7" style={{ background: theme.bg }}>
      {sectionNum && (
        <span className="text-xs font-bold mb-1" style={{ color: theme.accent }}>{sectionNum}</span>
      )}
      <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: theme.title }}>
        {slide.title}
      </h3>
      {td && td.headers.length > 0 ? (
        <div className="overflow-hidden rounded-sm text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {td.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-white font-semibold text-center" style={{ background: theme.dark }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {td.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? theme.accentLight : '#FFFFFF' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-center" style={{ color: theme.text, borderBottom: `1px solid ${theme.accentLight}` }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <MinBulletList items={slide.content} theme={theme} />
      )}
    </div>
  )
}

function MinConclusionSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="relative flex h-full" style={{ background: theme.dark }}>
      {/* Left content */}
      <div className="flex-1 flex flex-col justify-center pl-10">
        {/* Accent vertical line */}
        <div className="absolute left-8 top-[25%] bottom-[25%] w-0.5" style={{ background: theme.accent }} />
        <p className="text-[10px] font-bold tracking-[0.2em] mb-2 pl-4" style={{ color: theme.accent }}>
          СПАСИБО ЗА ВНИМАНИЕ
        </p>
        <h2 className="text-4xl font-bold pl-4" style={{ fontFamily: 'Georgia, serif', color: '#FFFFFF' }}>
          {slide.title || 'Вопросы?'}
        </h2>
        {slide.content.length > 0 && (
          <div className="mt-4 pl-4 space-y-0.5">
            {slide.content.map((line, i) => (
              <p key={i} className="text-xs" style={{ color: theme.muted }}>{line}</p>
            ))}
          </div>
        )}
      </div>
      {/* Decorative blocks */}
      <div className="w-[25%] relative mr-6 my-6">
        <div className="absolute top-0 right-0 w-full h-[55%] rounded-sm" style={{ background: theme.accentLight }} />
        <div className="absolute bottom-0 right-0 w-[80%] h-[40%] rounded-sm" style={{ background: theme.accent }} />
      </div>
    </div>
  )
}

function MinBulletList({ items, theme }: { items: string[]; theme: ThemeColors }) {
  return (
    <ul className="space-y-2.5 flex-1 overflow-hidden">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
          <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full" style={{ background: theme.accent }} />
          <span style={{ color: theme.text }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function getSectionNum(slideIndex: number, totalSlides: number): string | null {
  // Skip title (first) and conclusion (last)
  if (slideIndex === 0 || slideIndex === totalSlides - 1) return null
  return String(slideIndex).padStart(2, '0')
}

// =============================================================================
// Default slide type renderers (for non-minimal themes)
// =============================================================================

function TitleSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-12" style={{ background: theme.bg }}>
      <div className="absolute top-0 left-0 right-0 h-2" style={{ background: theme.accent }} />
      {/* Decorative vertical accent */}
      <div className="absolute left-8 top-[20%] bottom-[20%] w-0.5" style={{ background: theme.accent }} />
      <h2 className="text-4xl sm:text-5xl font-bold text-center leading-tight mb-4" style={{ color: theme.title, fontFamily: 'Georgia, serif' }}>
        {slide.title}
      </h2>
      {slide.content.length > 0 && (
        <p className="text-lg text-center opacity-80 max-w-lg" style={{ color: theme.text }}>
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
      <div className="mt-5 bg-gray-50 rounded-xl p-5 flex-1 overflow-hidden">
        <ul className="space-y-3">
          {slide.content.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-lg leading-relaxed">
              <span className="mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: theme.accent }} />
              <span style={{ color: theme.text }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>
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
        <div className="flex-1 space-y-3 bg-gray-50 rounded-xl p-4">
          {left.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[17px] leading-relaxed">
              <span className="mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: theme.accent }} />
              <span style={{ color: theme.text }}>{item}</span>
            </div>
          ))}
        </div>
        <div className="w-px self-stretch" style={{ background: theme.accent, opacity: 0.3 }} />
        <div className="flex-1 space-y-3 bg-gray-50 rounded-xl p-4">
          {right.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[17px] leading-relaxed">
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
      <div className="mt-5 rounded-xl p-6 flex-1 overflow-hidden" style={{ background: theme.accentLight, borderTop: `3px solid ${theme.accent}` }}>
        {slide.content.map((item, i) => (
          <p key={i} className={`leading-relaxed mb-2 ${i === 0 ? 'text-lg font-bold' : 'text-base'}`}
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
        <p className="text-3xl font-bold text-center" style={{ color: theme.accent }}>{formula}</p>
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
      <div className="mt-5 bg-gray-50 rounded-xl p-5 flex-1 overflow-hidden" style={{ borderLeft: `3px solid ${theme.accent}` }}>
        <div className="space-y-3">
          {slide.content.map((item, i) => (
            <p key={i} className="text-lg leading-relaxed pl-3" style={{ color: theme.text }}>{item}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConclusionSlide({ slide, theme }: { slide: PresentationSlide; theme: ThemeColors }) {
  return (
    <div className="flex flex-col h-full px-10 pt-10" style={{ background: theme.bg }}>
      <div className="absolute top-0 left-0 right-0 h-3" style={{ background: theme.accent }} />
      <h3 className="text-3xl font-bold text-center mb-6" style={{ color: theme.title, fontFamily: 'Georgia, serif' }}>{slide.title}</h3>
      <div className="space-y-3 flex-1 overflow-hidden">
        {slide.content.map((item, i) => (
          <div key={i} className="flex items-start gap-3 text-lg leading-relaxed">
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
      <h3 className="text-2xl font-bold leading-tight pl-3" style={{ color: theme.title, fontFamily: 'Georgia, serif', borderLeft: `3px solid ${theme.accent}` }}>{title}</h3>
      <div className="w-20 h-0.5 mt-2" style={{ background: theme.accent }} />
    </>
  )
}

function BulletList({ items, theme }: { items: string[]; theme: ThemeColors }) {
  return (
    <ul className="mt-5 space-y-3 flex-1 overflow-hidden">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-lg leading-relaxed">
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
type SlideRendererWithIndex = (props: SlideRendererProps & { index: number; total: number }) => React.JSX.Element
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

// Minimalism renderers need index/total for section numbers
const MIN_RENDERERS: Record<PresentationSlide['type'], SlideRendererWithIndex> = {
  title: ({ slide, theme }) => <MinTitleSlide slide={slide} theme={theme} />,
  content: ({ slide, theme, index, total }) => <MinContentSlide slide={slide} theme={theme} index={index} total={total} />,
  twoColumn: ({ slide, theme, index, total }) => <MinTwoColumnSlide slide={slide} theme={theme} index={index} total={total} />,
  table: ({ slide, theme, index, total }) => <MinTableSlide slide={slide} theme={theme} index={index} total={total} />,
  example: ({ slide, theme, index, total }) => <MinExampleSlide slide={slide} theme={theme} index={index} total={total} />,
  formula: ({ slide, theme, index, total }) => <MinFormulaSlide slide={slide} theme={theme} index={index} total={total} />,
  diagram: ({ slide, theme, index, total }) => <MinContentSlide slide={slide} theme={theme} index={index} total={total} />,
  chart: ({ slide, theme, index, total }) => <MinContentSlide slide={slide} theme={theme} index={index} total={total} />,
  practice: ({ slide, theme, index, total }) => <MinPracticeSlide slide={slide} theme={theme} index={index} total={total} />,
  conclusion: ({ slide, theme }) => <MinConclusionSlide slide={slide} theme={theme} />,
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
  const isMinimal = themePreset === 'minimal'
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

  const renderSlide = (s: PresentationSlide, idx: number) => {
    if (isMinimal) {
      const MinRenderer = MIN_RENDERERS[s.type] || MIN_RENDERERS.content
      return <MinRenderer slide={s} theme={theme} index={idx} total={totalSlides} />
    }
    const Renderer = SLIDE_RENDERERS[s.type] || ContentSlide
    return <Renderer slide={s} theme={theme} />
  }

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
            {renderSlide(slide, currentSlide)}
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
          {structure.slides.map((s, idx) => (
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
                    {renderSlide(s, idx)}
                  </div>
                </div>
              </div>
              {/* Slide number overlay */}
              <div className="absolute bottom-0.5 right-1 text-[9px] font-semibold px-1 rounded bg-black/40 text-white">
                {idx + 1}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
