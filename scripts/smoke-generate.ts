import 'dotenv/config'
import { getAIProvider } from '../api/_lib/ai-provider.js'
import { buildPdf } from '../api/_lib/pdf.js'
import { WorksheetSchema, type Subject } from '../shared/worksheet.js'

// Force Dummy provider if not set (or use what's in .env)
// To test with OpenAI, set AI_PROVIDER=openai and ensure OPENAI_API_KEY is in .env
// Note: api/_lib/ai-provider.ts now checks NODE_ENV=production for OpenAI.
// We can simulate production if we want to test OpenAI.
const USE_REAL_AI = process.env.SMOKE_REAL_AI === 'true'

if (USE_REAL_AI) {
  process.env.NODE_ENV = 'production'
  process.env.AI_PROVIDER = 'openai'
  console.log('🤖 SMOKE TEST: Running with REAL OpenAI Provider')
} else {
  console.log('🤖 SMOKE TEST: Running with Dummy Provider')
}

const subjects: Subject[] = ['math', 'russian']
const grades = [1, 2, 3, 4]
const topic = 'тестовая тема для смоук-теста'

async function run() {
  const provider = getAIProvider()
  let passed = 0
  let failed = 0

  console.log('🚀 Starting smoke tests...\n')

  for (const subject of subjects) {
    for (const grade of grades) {
      const label = `[${subject.toUpperCase()} - Grade ${grade}]`
      process.stdout.write(`${label} Generating... `)

      try {
        const params = { subject, grade, topic }
        
        // 1. Generate Worksheet Structure
        const worksheet = await provider.generateWorksheet(params, (p) => {
          // Ignore progress
        })

        // 2. Generate PDF
        const pdfBase64 = await buildPdf(worksheet, params)
        const finalWorksheet = {
          ...worksheet,
          pdfBase64
        }

        // 3. Validate Schema
        const parseResult = WorksheetSchema.safeParse(finalWorksheet)

        if (!parseResult.success) {
          console.log('❌ FAIL (Schema Validation)')
          console.error(parseResult.error.format())
          failed++
          continue
        }

        // 4. Validate Content Checks
        if (!finalWorksheet.pdfBase64 || finalWorksheet.pdfBase64.length === 0) {
           console.log('❌ FAIL (Empty PDF)')
           failed++
           continue
        }

        if (finalWorksheet.assignments.length !== 7) {
           console.log(`❌ FAIL (Assignments count: ${finalWorksheet.assignments.length}, expected 7)`)
           failed++
           continue
        }

        if (finalWorksheet.test.length !== 10) {
           console.log(`❌ FAIL (Test count: ${finalWorksheet.test.length}, expected 10)`)
           failed++
           continue
        }

        console.log('✅ PASS')
        passed++

      } catch (e: any) {
        console.log('❌ FAIL (Exception)')
        console.error(e)
        failed++
      }
    }
  }

  console.log('\n----------------------------------------')
  console.log(`Summary: ${passed} Passed, ${failed} Failed`)
  
  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

run().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
