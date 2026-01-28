import React, { useMemo } from 'react'
import katex from 'katex'

interface MathRendererProps {
  text: string
  className?: string
}

/**
 * Renders text with LaTeX math formulas using KaTeX.
 * Supports:
 * - \(...\) for inline math
 * - \[...\] for block math
 * - Raw LaTeX commands like \frac{}{}, \sqrt{}, \sin, \cos, \tan, etc.
 */
export default function MathRenderer({ text, className = '' }: MathRendererProps) {
  const renderedHtml = useMemo(() => {
    if (!text) return ''

    try {
      return renderMathInText(text)
    } catch (e) {
      console.error('MathRenderer error:', e)
      return escapeHtml(text)
    }
  }, [text])

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  )
}

/**
 * Parses text and renders LaTeX formulas
 */
function renderMathInText(text: string): string {
  // First, handle explicit delimiters \(...\) and \[...\]
  let processedText = text

  // Replace \(...\) with rendered KaTeX
  processedText = processedText.replace(/\\\(([^]*?)\\\)/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), {
        throwOnError: false,
        displayMode: false,
        trust: true,
        strict: false,
      })
    } catch {
      return escapeHtml(match)
    }
  })

  // Replace \[...\] with rendered KaTeX (display mode)
  processedText = processedText.replace(/\\\[([^]*?)\\\]/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), {
        throwOnError: false,
        displayMode: true,
        trust: true,
        strict: false,
      })
    } catch {
      return escapeHtml(match)
    }
  })

  // Now handle raw LaTeX commands without delimiters
  // This regex finds LaTeX expressions including those preceded by - or +
  // Match optional leading minus/plus, then LaTeX commands with braces
  const rawLatexPattern = /[-+]?\\(?:frac|sqrt|vec|bar|overline|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|log|ln|exp|lim|sum|prod|int|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega|pm|mp|times|div|cdot|leq|geq|neq|approx|equiv|infty|partial|nabla|angle|perp|parallel|triangle|circ|degree)(?:\{[^}]*\})*(?:\{[^}]*\})*(?:\^\\circ|\^\{[^}]+\}|\^[0-9]|_\{[^}]+\}|_[0-9])*/g

  processedText = processedText.replace(rawLatexPattern, (match) => {
    // Skip if it's already been rendered (contains HTML tags)
    if (match.includes('<') || match.includes('>')) {
      return match
    }
    try {
      return katex.renderToString(match.trim(), {
        throwOnError: false,
        displayMode: false,
        trust: true,
        strict: false,
      })
    } catch {
      return escapeHtml(match)
    }
  })

  // Handle standalone ^{...} and _{...} that weren't caught
  processedText = processedText.replace(/([a-zA-Z0-9])(\^{[^}]+}|_{[^}]+})/g, (match, base, script) => {
    // Skip if it's already been rendered
    if (match.includes('<')) return match
    try {
      return escapeHtml(base) + katex.renderToString(script, {
        throwOnError: false,
        displayMode: false,
        trust: true,
        strict: false,
      })
    } catch {
      return escapeHtml(match)
    }
  })

  // Handle ^{\circ} and ^\circ for degrees (like 30° or 30^\circ)
  processedText = processedText.replace(/(\d+)(?:\^\{\\circ\}|\^\\circ)/g, (match, num) => {
    try {
      return katex.renderToString(num + '^\\circ', {
        throwOnError: false,
        displayMode: false,
        trust: true,
        strict: false,
      })
    } catch {
      return escapeHtml(match)
    }
  })

  // Handle standalone ^\circ after any character
  processedText = processedText.replace(/([a-zA-Z])(?:\^\{\\circ\}|\^\\circ)/g, (match, char) => {
    try {
      return escapeHtml(char) + katex.renderToString('^\\circ', {
        throwOnError: false,
        displayMode: false,
        trust: true,
        strict: false,
      })
    } catch {
      return escapeHtml(match)
    }
  })

  // Escape any remaining unprocessed text that doesn't contain HTML
  // Split by HTML tags and escape non-HTML parts
  const parts = processedText.split(/(<[^>]+>)/g)
  return parts.map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return part // Keep HTML tags
    }
    // Check if there are any remaining backslash commands
    if (part.includes('\\') && !part.includes('<')) {
      // Try to render remaining LaTeX
      const latexMatch = part.match(/\\[a-zA-Z]+(?:\{[^}]*\})*/)
      if (latexMatch) {
        try {
          const rendered = katex.renderToString(latexMatch[0], {
            throwOnError: false,
            displayMode: false,
            trust: true,
            strict: false,
          })
          return part.replace(latexMatch[0], rendered)
        } catch {
          return part
        }
      }
    }
    return part
  }).join('')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Converts LaTeX to plain Unicode text for PDF generation.
 * Handles both delimited \(...\) and raw LaTeX commands.
 */
export function latexToUnicode(text: string): string {
  if (!text) return ''

  let result = text

  // Process \(...\) and \[...\] blocks first
  result = result.replace(/\\\(([^]*?)\\\)|\\\[([^]*?)\\\]/g, (match, inline, display) => {
    const latex = (inline || display || '').trim()
    return convertLatexToUnicode(latex)
  })

  // Then process raw LaTeX commands
  result = convertLatexToUnicode(result)

  return result
}

function convertLatexToUnicode(latex: string): string {
  let result = latex

  // Vectors: \vec{a} → a⃗
  result = result.replace(/\\vec\{([^}]+)\}/g, '$1\u20D7')
  result = result.replace(/\\vec ([a-zA-Z])/g, '$1\u20D7')

  // Overline/bar: \bar{a} → ā or \overline{AB} → A̅B̅
  result = result.replace(/\\(?:bar|overline)\{([^}]+)\}/g, (_, content) => {
    return content.split('').map((c: string) => c + '\u0305').join('')
  })

  // Fractions: \frac{a}{b} → a/b
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')

  // Square root: \sqrt{x} → √x
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
  result = result.replace(/\\sqrt ([a-zA-Z0-9])/g, '√$1')

  // Trig functions
  result = result.replace(/\\sin\s*/g, 'sin ')
  result = result.replace(/\\cos\s*/g, 'cos ')
  result = result.replace(/\\tan\s*/g, 'tan ')
  result = result.replace(/\\cot\s*/g, 'cot ')
  result = result.replace(/\\sec\s*/g, 'sec ')
  result = result.replace(/\\csc\s*/g, 'csc ')
  result = result.replace(/\\arcsin\s*/g, 'arcsin ')
  result = result.replace(/\\arccos\s*/g, 'arccos ')
  result = result.replace(/\\arctan\s*/g, 'arctan ')
  result = result.replace(/\\log\s*/g, 'log ')
  result = result.replace(/\\ln\s*/g, 'ln ')
  result = result.replace(/\\exp\s*/g, 'exp ')
  result = result.replace(/\\lim\s*/g, 'lim ')

  // Degree: ^\circ → °
  result = result.replace(/\^\\circ/g, '°')
  result = result.replace(/\\circ/g, '°')
  result = result.replace(/\\degree/g, '°')

  // Superscripts (basic)
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ',
  }
  result = result.replace(/\^\{([^}]+)\}/g, (_, exp) => {
    return exp.split('').map((c: string) => superscripts[c] || `^${c}`).join('')
  })
  result = result.replace(/\^([0-9n])/g, (_, c) => superscripts[c] || `^${c}`)

  // Subscripts (basic)
  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'i': 'ᵢ', 'o': 'ₒ', 'u': 'ᵤ',
    'x': 'ₓ', 'n': 'ₙ', 'm': 'ₘ',
  }
  result = result.replace(/_\{([^}]+)\}/g, (_, sub) => {
    return sub.split('').map((c: string) => subscripts[c] || `_${c}`).join('')
  })
  result = result.replace(/_([0-9])/g, (_, c) => subscripts[c] || `_${c}`)

  // Greek letters
  const greekLetters: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
    '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
    '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
    '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
    '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
    '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
    '\\Psi': 'Ψ', '\\Omega': 'Ω',
  }
  for (const [tex, unicode] of Object.entries(greekLetters)) {
    result = result.replace(new RegExp(tex.replace(/\\/g, '\\\\'), 'g'), unicode)
  }

  // Math operators and symbols
  const symbols: Record<string, string> = {
    '\\cdot': '·', '\\times': '×', '\\div': '÷',
    '\\pm': '±', '\\mp': '∓',
    '\\leq': '≤', '\\geq': '≥', '\\neq': '≠',
    '\\approx': '≈', '\\equiv': '≡',
    '\\infty': '∞', '\\partial': '∂',
    '\\sum': 'Σ', '\\prod': 'Π', '\\int': '∫',
    '\\rightarrow': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔',
    '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
    '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥',
    '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃',
    '\\cup': '∪', '\\cap': '∩',
    '\\forall': '∀', '\\exists': '∃',
    '\\nabla': '∇', '\\triangle': '△',
    '\\,': ' ', '\\;': ' ', '\\quad': '  ', '\\qquad': '    ',
  }
  for (const [tex, unicode] of Object.entries(symbols)) {
    result = result.replace(new RegExp(tex.replace(/\\/g, '\\\\'), 'g'), unicode)
  }

  // Remove remaining LaTeX commands like \text{}, \mathrm{}, etc.
  result = result.replace(/\\(?:text|mathrm|mathbf|mathit|mathsf)\{([^}]+)\}/g, '$1')

  // Remove curly braces used for grouping
  result = result.replace(/\{([^{}]+)\}/g, '$1')

  // Clean up any remaining backslashes before common letters
  result = result.replace(/\\([a-zA-Z]+)/g, '$1')

  return result.trim()
}
