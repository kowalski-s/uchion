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
 * Extract a balanced brace group starting at position i
 * Returns the content inside braces and the end position
 */
function extractBraceGroup(text: string, start: number): { content: string; end: number } | null {
  if (text[start] !== '{') return null

  let depth = 0
  let i = start

  while (i < text.length) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) {
        return {
          content: text.slice(start, i + 1),
          end: i + 1
        }
      }
    }
    i++
  }

  return null // Unbalanced braces
}

/**
 * Find LaTeX expression starting at position i
 * Returns the full LaTeX expression and end position
 */
function extractLatexExpression(text: string, start: number): { latex: string; end: number } | null {
  // Check for optional leading minus/plus
  let i = start
  let latex = ''

  // Handle leading - or +
  if (text[i] === '-' || text[i] === '+') {
    latex += text[i]
    i++
    // Skip whitespace between operator and backslash
    while (i < text.length && text[i] === ' ') {
      i++
    }
  }

  // Must start with backslash
  if (i >= text.length || text[i] !== '\\') return null

  // Extract command name
  let cmdStart = i
  i++ // skip backslash

  // Read command name (letters only)
  while (i < text.length && /[a-zA-Z]/.test(text[i])) {
    i++
  }

  const cmdName = text.slice(cmdStart + 1, i)

  // List of known LaTeX commands - comprehensive list for math expressions
  const knownCommands = [
    // Fractions and roots
    'frac', 'dfrac', 'tfrac', 'sqrt', 'root',
    // Vectors and decorations
    'vec', 'bar', 'overline', 'underline', 'hat', 'tilde', 'dot', 'ddot', 'widehat', 'widetilde',
    // Trigonometric functions
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'arcsin', 'arccos', 'arctan', 'arccot',
    'sinh', 'cosh', 'tanh', 'coth',
    // Logarithms and exponentials
    'log', 'ln', 'lg', 'exp',
    // Calculus
    'lim', 'sum', 'prod', 'int', 'iint', 'iiint', 'oint',
    // Greek letters (lowercase)
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho',
    'sigma', 'varsigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
    // Greek letters (uppercase)
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
    'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Pi', 'Rho',
    'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
    // Binary operators
    'pm', 'mp', 'times', 'div', 'cdot', 'ast', 'star', 'bullet', 'oplus', 'ominus', 'otimes',
    // Relations
    'leq', 'le', 'geq', 'ge', 'neq', 'ne', 'approx', 'equiv', 'sim', 'simeq', 'cong', 'propto',
    'll', 'gg', 'prec', 'succ', 'preceq', 'succeq',
    // Arrows
    'to', 'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow', 'leftrightarrow', 'Leftrightarrow',
    'uparrow', 'downarrow', 'Uparrow', 'Downarrow', 'nearrow', 'searrow', 'swarrow', 'nwarrow',
    'mapsto', 'longmapsto', 'longrightarrow', 'longleftarrow',
    // Symbols
    'infty', 'partial', 'nabla', 'angle', 'perp', 'parallel', 'triangle', 'square', 'diamond',
    'circ', 'degree', 'prime', 'backprime', 'hbar', 'ell', 'wp', 'Re', 'Im',
    // Delimiters
    'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'langle', 'rangle', 'lfloor', 'rfloor', 'lceil', 'rceil',
    // Text modes
    'text', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'mathbb', 'mathfrak',
    // Set theory
    'in', 'notin', 'ni', 'subset', 'supset', 'subseteq', 'supseteq', 'cup', 'cap', 'setminus', 'emptyset', 'varnothing',
    // Logic
    'forall', 'exists', 'nexists', 'neg', 'lnot', 'land', 'lor', 'implies', 'iff',
    // Spacing and misc
    'quad', 'qquad', 'space', 'phantom', 'vphantom', 'hphantom',
    // Special symbols
    'therefore', 'because', 'ldots', 'cdots', 'vdots', 'ddots',
  ]

  if (!knownCommands.includes(cmdName)) return null

  latex += text.slice(cmdStart, i)

  // Extract brace groups (for commands like \frac{}{}, \sqrt{})
  while (i < text.length && text[i] === '{') {
    const group = extractBraceGroup(text, i)
    if (group) {
      latex += group.content
      i = group.end
    } else {
      break
    }
  }

  // Handle superscripts and subscripts
  while (i < text.length) {
    if (text[i] === '^' || text[i] === '_') {
      latex += text[i]
      i++

      if (i < text.length) {
        if (text[i] === '{') {
          const group = extractBraceGroup(text, i)
          if (group) {
            latex += group.content
            i = group.end
          }
        } else if (text[i] === '\\') {
          // Handle ^\circ
          let j = i + 1
          while (j < text.length && /[a-zA-Z]/.test(text[j])) j++
          latex += text.slice(i, j)
          i = j
        } else {
          // Single character superscript/subscript
          latex += text[i]
          i++
        }
      }
    } else {
      break
    }
  }

  return { latex, end: i }
}

/**
 * Pre-process LaTeX to convert non-standard commands to KaTeX-supported equivalents
 */
function preprocessLatex(latex: string): string {
  let result = latex

  // Commands that KaTeX doesn't support natively - convert to \operatorname{}
  const operatornameCommands = [
    'arccot', 'arcsec', 'arccsc',
    'coth', 'sech', 'csch',
    'sgn', 'sign',
    'grad', 'curl', 'rot',
    'tr', 'Tr', 'rank', 'diag',
    'lcm', 'gcd',
    'tg', 'ctg', 'cosec',  // Russian/European notation
    'arctg', 'arcctg',      // Russian notation for arctan, arccot
    'sh', 'ch', 'th', 'cth', // Russian hyperbolic notation
  ]

  for (const cmd of operatornameCommands) {
    // Replace \cmd with \operatorname{cmd}
    const regex = new RegExp(`\\\\${cmd}(?![a-zA-Z])`, 'g')
    result = result.replace(regex, `\\operatorname{${cmd}}`)
  }

  // Handle degree symbol variations
  result = result.replace(/\\degree/g, '^\\circ')

  // Handle vector arrow over letter: \vec{a} is supported, but ensure it works
  // KaTeX supports \vec, \overrightarrow, \overleftarrow

  // Handle special symbols that might not render correctly
  result = result.replace(/\\parallel/g, '\\|')

  return result
}

/**
 * Parses text and renders LaTeX formulas
 */
function renderMathInText(text: string): string {
  // Normalize text: handle double-escaped backslashes from JSON parsing
  let processedText = text.replace(/\\\\/g, '\\')

  // First, handle explicit delimiters \(...\) and \[...\]
  // Replace \(...\) with rendered KaTeX
  processedText = processedText.replace(/\\\(([^]*?)\\\)/g, (match, latex) => {
    try {
      const preprocessed = preprocessLatex(latex.trim())
      return katex.renderToString(preprocessed, {
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
      const preprocessed = preprocessLatex(latex.trim())
      return katex.renderToString(preprocessed, {
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
  // Process character by character to find LaTeX expressions
  let result = ''
  let i = 0

  while (i < processedText.length) {
    // Check if this could be start of LaTeX
    // Cases: \command, -\command, +\command
    let canStartLatex = false

    if (processedText[i] === '\\') {
      // Direct backslash - likely LaTeX command
      canStartLatex = true
    } else if ((processedText[i] === '-' || processedText[i] === '+')) {
      // Check if followed by backslash (with optional whitespace)
      let nextIdx = i + 1
      // Skip whitespace between operator and backslash
      while (nextIdx < processedText.length && processedText[nextIdx] === ' ') {
        nextIdx++
      }
      if (nextIdx < processedText.length && processedText[nextIdx] === '\\') {
        canStartLatex = true
      }
    }

    if (canStartLatex) {
      // Skip if already rendered (inside HTML tag)
      if (result.endsWith('<') || (result.includes('<') && !result.includes('>'))) {
        result += processedText[i]
        i++
        continue
      }

      const expr = extractLatexExpression(processedText, i)
      if (expr && expr.latex.length > 1) {
        try {
          const preprocessed = preprocessLatex(expr.latex)
          const rendered = katex.renderToString(preprocessed, {
            throwOnError: false,
            displayMode: false,
            trust: true,
            strict: false,
          })
          result += rendered
          i = expr.end
          continue
        } catch {
          // Fall through to add character normally
        }
      }
    }

    // Handle degree notation: number followed by ^\circ or ^{\circ}
    if (/\d/.test(processedText[i])) {
      let numEnd = i
      while (numEnd < processedText.length && /\d/.test(processedText[numEnd])) {
        numEnd++
      }

      const afterNum = processedText.slice(numEnd)
      if (afterNum.startsWith('^\\circ') || afterNum.startsWith('^{\\circ}')) {
        const num = processedText.slice(i, numEnd)
        const degreeLen = afterNum.startsWith('^{\\circ}') ? 8 : 6
        try {
          const rendered = katex.renderToString(num + '^\\circ', {
            throwOnError: false,
            displayMode: false,
            trust: true,
            strict: false,
          })
          result += rendered
          i = numEnd + degreeLen
          continue
        } catch {
          // Fall through
        }
      }
    }

    // Regular character - escape if needed
    const char = processedText[i]
    if (char === '<' || char === '>' || char === '&' || char === '"' || char === "'") {
      // Check if it's part of an HTML tag (already rendered KaTeX)
      if (char === '<' && processedText.slice(i).match(/^<[a-zA-Z\/]/)) {
        // It's an HTML tag, find closing >
        const tagEnd = processedText.indexOf('>', i)
        if (tagEnd !== -1) {
          result += processedText.slice(i, tagEnd + 1)
          i = tagEnd + 1
          continue
        }
      }
      result += escapeHtml(char)
    } else {
      result += char
    }
    i++
  }

  return result
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

  // Normalize double-escaped backslashes from JSON parsing
  let result = text.replace(/\\\\/g, '\\')

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

  // Fractions: \frac{a}{b} → a/b (handle nested)
  let prevResult = ''
  while (prevResult !== result) {
    prevResult = result
    result = result.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '($1/$2)')
  }

  // Square root: \sqrt{x} → √x (handle nested)
  prevResult = ''
  while (prevResult !== result) {
    prevResult = result
    result = result.replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '√($1)')
  }
  result = result.replace(/\\sqrt ([a-zA-Z0-9])/g, '√$1')

  // Trig functions (standard)
  result = result.replace(/\\sin\s*/g, 'sin ')
  result = result.replace(/\\cos\s*/g, 'cos ')
  result = result.replace(/\\tan\s*/g, 'tan ')
  result = result.replace(/\\cot\s*/g, 'cot ')
  result = result.replace(/\\sec\s*/g, 'sec ')
  result = result.replace(/\\csc\s*/g, 'csc ')
  result = result.replace(/\\arcsin\s*/g, 'arcsin ')
  result = result.replace(/\\arccos\s*/g, 'arccos ')
  result = result.replace(/\\arctan\s*/g, 'arctan ')
  result = result.replace(/\\arccot\s*/g, 'arccot ')
  result = result.replace(/\\arcsec\s*/g, 'arcsec ')
  result = result.replace(/\\arccsc\s*/g, 'arccsc ')

  // Russian/European trig notation
  result = result.replace(/\\tg\s*/g, 'tg ')
  result = result.replace(/\\ctg\s*/g, 'ctg ')
  result = result.replace(/\\cosec\s*/g, 'cosec ')
  result = result.replace(/\\arctg\s*/g, 'arctg ')
  result = result.replace(/\\arcctg\s*/g, 'arcctg ')

  // Hyperbolic functions
  result = result.replace(/\\sinh\s*/g, 'sinh ')
  result = result.replace(/\\cosh\s*/g, 'cosh ')
  result = result.replace(/\\tanh\s*/g, 'tanh ')
  result = result.replace(/\\coth\s*/g, 'coth ')
  result = result.replace(/\\sech\s*/g, 'sech ')
  result = result.replace(/\\csch\s*/g, 'csch ')

  // Russian hyperbolic notation
  result = result.replace(/\\sh\s*/g, 'sh ')
  result = result.replace(/\\ch\s*/g, 'ch ')
  result = result.replace(/\\th\s*/g, 'th ')
  result = result.replace(/\\cth\s*/g, 'cth ')

  // Logarithms and other functions
  result = result.replace(/\\log\s*/g, 'log ')
  result = result.replace(/\\ln\s*/g, 'ln ')
  result = result.replace(/\\lg\s*/g, 'lg ')
  result = result.replace(/\\exp\s*/g, 'exp ')
  result = result.replace(/\\lim\s*/g, 'lim ')

  // Handle \operatorname{...}
  result = result.replace(/\\operatorname\{([^}]+)\}/g, '$1 ')

  // Degree: ^\circ → °
  result = result.replace(/\^\{?\\circ\}?/g, '°')
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
  result = result.replace(/\{([^{}]*)\}/g, '$1')

  // Clean up any remaining backslashes before common letters
  result = result.replace(/\\([a-zA-Z]+)/g, '$1')

  return result.trim()
}
