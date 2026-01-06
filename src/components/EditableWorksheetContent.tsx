import React from 'react'
import type { Worksheet } from '../../shared/types'

interface EditableWorksheetContentProps {
  worksheet: Worksheet
  isEditMode: boolean
  onUpdateAssignment: (index: number, field: 'title' | 'text', value: string) => void
  onUpdateTestQuestion: (index: number, value: string) => void
  onUpdateTestOption: (questionIndex: number, optionIndex: number, value: string) => void
  onUpdateAssignmentAnswer: (index: number, value: string) => void
  onUpdateTestAnswer: (index: number, value: string) => void
}

const shouldShowAnswerField = (text: string) => {
  const lower = text.toLowerCase()
  const hiddenKeywords = ['подчеркни', 'обведи', 'зачеркни', 'раскрась', 'соедини']
  return !hiddenKeywords.some(k => lower.includes(k))
}

// Editable text area for assignments
const EditableTextArea = ({
  value,
  onChange,
  isEditMode,
  className = '',
  placeholder = '',
}: {
  value: string
  onChange: (value: string) => void
  isEditMode: boolean
  className?: string
  placeholder?: string
}) => {
  if (!isEditMode) {
    return <span className={className}>{value}</span>
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full p-2 border border-indigo-200 rounded-lg bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition-all ${className}`}
      rows={Math.max(2, Math.ceil(value.length / 60))}
    />
  )
}

// Editable input for single-line fields
const EditableInput = ({
  value,
  onChange,
  isEditMode,
  className = '',
  placeholder = '',
}: {
  value: string
  onChange: (value: string) => void
  isEditMode: boolean
  className?: string
  placeholder?: string
}) => {
  if (!isEditMode) {
    return <span className={className}>{value}</span>
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full p-2 border border-indigo-200 rounded-lg bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all ${className}`}
    />
  )
}

// Page container component
const PageContainer = ({ children, id, className = '' }: { children: React.ReactNode, id?: string, className?: string }) => (
  <div id={id} className={`mx-auto max-w-[210mm] bg-white p-[15mm] shadow-lg border border-gray-100 rounded-xl mb-12 last:mb-0 print:max-w-none print:w-full print:shadow-none print:p-[10mm] print:border-0 print:rounded-none print:mb-0 print:mx-0 ${className}`}>
    {children}
  </div>
)

export default function EditableWorksheetContent({
  worksheet,
  isEditMode,
  onUpdateAssignment,
  onUpdateTestQuestion,
  onUpdateTestOption,
  onUpdateAssignmentAnswer,
  onUpdateTestAnswer,
}: EditableWorksheetContentProps) {
  return (
    <div id="worksheet-pdf-root" className="worksheet-pdf-root">
      {/* PAGE 1: Assignments */}
      <PageContainer id="page1">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-gray-100 pb-4 gap-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <span className="text-2xl font-bold tracking-tight">УчиОн</span>
          </div>
          <div className="text-sm text-gray-500 w-full sm:w-auto sm:min-w-[320px]">
            <div className="flex flex-col gap-2 w-full max-w-full">
              <div className="flex items-center gap-2 w-full">
                <span className="whitespace-nowrap">Имя и фамилия:</span>
                <div className="border-b border-gray-300 flex-1 min-w-0"></div>
              </div>
              <div className="flex items-center gap-2 w-full">
                <span className="whitespace-nowrap">Дата:</span>
                <div className="border-b border-gray-300 flex-1 min-w-0"></div>
              </div>
            </div>
          </div>
        </div>

        <h1 className="mb-6 text-center text-3xl font-bold text-gray-900">{worksheet.topic}</h1>

        {/* Assignments Section */}
        <section className="flex flex-col">
          <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 print:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">E</span>
            Задания
            {isEditMode && <span className="text-sm font-normal text-indigo-500 ml-2">(режим редактирования)</span>}
          </h2>
          <h2 className="hidden print:flex mb-4 text-lg font-bold text-gray-900 border-b pb-2 items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-white text-xs">E</span>
            Задания
          </h2>

          <div className="flex flex-col gap-6">
            {worksheet.assignments.map((task, i) => (
              <div key={i} className={`task-block break-inside-avoid ${i === 0 ? 'mt-2' : ''} ${isEditMode ? 'bg-indigo-50/20 p-4 rounded-xl border border-indigo-100' : ''}`}>
                <div className="mb-3 text-lg font-medium text-gray-900 leading-tight">
                  <span className="mr-2 text-indigo-600 print:text-black">{i + 1}.</span>
                  <EditableTextArea
                    value={task.text}
                    onChange={(value) => onUpdateAssignment(i, 'text', value)}
                    isEditMode={isEditMode}
                  />
                </div>
                {shouldShowAnswerField(task.text) && (
                  <div className="mt-3 h-48 w-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/30 print:border-gray-300 print:h-32"></div>
                )}
              </div>
            ))}
          </div>
        </section>
      </PageContainer>

      <div className="page-break"></div>

      {/* PAGE 2: Test */}
      <PageContainer id="page2">
        <section className="h-full flex flex-col">
          <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 print:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">T</span>
            Мини-тест
            {isEditMode && <span className="text-sm font-normal text-indigo-500 ml-2">(режим редактирования)</span>}
          </h2>
          <h2 className="hidden print:flex mb-4 text-lg font-bold text-gray-900 border-b pb-2 items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-white text-xs">T</span>
            Мини-тест
          </h2>

          <div className="grid gap-6">
            {worksheet.test.map((q, i) => (
              <div key={i} className={`rounded-xl border bg-white p-5 shadow-sm break-inside-avoid print:border print:border-gray-300 print:shadow-none print:p-4 ${isEditMode ? 'border-indigo-200 bg-indigo-50/20' : 'border-gray-100'}`}>
                <div className="mb-3 font-medium text-gray-900">
                  <span className="mr-2">{i + 1}.</span>
                  <EditableInput
                    value={q.question}
                    onChange={(value) => onUpdateTestQuestion(i, value)}
                    isEditMode={isEditMode}
                    className="font-medium"
                  />
                </div>
                <div className="space-y-2">
                  {q.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 text-xs font-bold text-gray-500">
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <EditableInput
                        value={opt}
                        onChange={(value) => onUpdateTestOption(i, idx, value)}
                        isEditMode={isEditMode}
                        className="text-gray-700 flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </PageContainer>

      <div className="page-break"></div>

      {/* PAGE 3: Notes */}
      <PageContainer id="page3" className="flex flex-col">
        <section className="mb-8 break-inside-avoid">
          <div className="rounded-xl bg-gray-50 p-6">
            <h3 className="mb-4 font-bold text-gray-900">Oценка урока</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <div className="h-5 w-5 rounded border border-gray-300 bg-white" />
                <span>Все понял</span>
              </label>
              <label className="flex items-center gap-3">
                <div className="h-5 w-5 rounded border border-gray-300 bg-white" />
                <span>Было немного сложно</span>
              </label>
              <label className="flex items-center gap-3">
                <div className="h-5 w-5 rounded border border-gray-300 bg-white" />
                <span>Нужна помощь</span>
              </label>
            </div>
          </div>
        </section>

        <section className="break-inside-avoid flex-grow">
          <div className="rounded-xl bg-gray-50 p-6 h-full min-h-[600px] print:min-h-0">
            <h3 className="mb-4 font-bold text-gray-900">Заметки</h3>
            <div className="space-y-8">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="border-b border-gray-300" />
              ))}
            </div>
          </div>
        </section>
      </PageContainer>

      <div className="page-break"></div>

      {/* PAGE 4: Answers */}
      <PageContainer id="page4">
        <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
          Ответы
          {isEditMode && <span className="text-sm font-normal text-indigo-500 ml-2">(режим редактирования)</span>}
        </h2>
        <div className="grid gap-8 md:grid-cols-2 answers-grid">
          <div className="break-inside-avoid">
            <h3 className="mb-4 text-lg font-bold text-indigo-600">Задания</h3>
            <ul className="space-y-4">
              {worksheet.answers.assignments.map((ans, i) => (
                <li key={i} className={`rounded-lg p-3 text-sm text-gray-800 border ${isEditMode ? 'bg-indigo-50/30 border-indigo-200' : 'bg-gray-50 border-gray-100'} print:border-gray-200`}>
                  <span className="font-bold text-indigo-500 mr-2">{i + 1}.</span>
                  <EditableTextArea
                    value={ans}
                    onChange={(value) => onUpdateAssignmentAnswer(i, value)}
                    isEditMode={isEditMode}
                    className="text-sm"
                  />
                </li>
              ))}
            </ul>
          </div>
          <div className="break-inside-avoid">
            <h3 className="mb-4 text-lg font-bold text-indigo-600">Мини-тест</h3>
            <ul className="space-y-2">
              {worksheet.answers.test.map((ans, i) => (
                <li key={i} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-gray-800 border ${isEditMode ? 'bg-indigo-50/30 border-indigo-200' : 'bg-gray-50 border-gray-100'} print:border-gray-200`}>
                  <span className="font-bold text-indigo-500">{i + 1}.</span>
                  <EditableInput
                    value={ans}
                    onChange={(value) => onUpdateTestAnswer(i, value)}
                    isEditMode={isEditMode}
                    className="font-medium"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PageContainer>

      <style>{`
        .worksheet-pdf-root {
          background: white;
          padding: 16px 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        @media print {
          @page { margin: 10mm; size: auto; }
          body {
            background: white;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
          }

          .mx-auto.max-w-\\[210mm\\] {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          #page1 {
            padding-top: 0 !important;
          }

          .page-break { page-break-before: always; }

          .task-block, .card, .exercise, .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .task-block {
             margin-bottom: 12px;
          }

          .answers-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: 8mm;
            row-gap: 2mm;
          }

          nav, header, button, .print\\:hidden { display: none !important; }

          /* Hide edit mode styles in print */
          textarea, input[type="text"] {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
