import fs from 'fs/promises'
import path from 'path'
import { buildPdf as buildServerPdf } from '../api/_lib/pdf.js'
import { buildWorksheetPdf as buildClientPdf } from '../src/lib/pdf-client.js'
import type { Worksheet, GeneratePayload } from '../shared/types.js'

// --- Mock Browser Globals for Client PDF ---
// pdf-client uses `fetch` to load fonts. We need to intercept this.
// It also returns a Blob.

const publicFontsDir = path.join(process.cwd(), 'public/fonts')

global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = input.toString()
  console.log(`[MockFetch] Request: ${url}`)
  
  if (url.includes('/fonts/')) {
    const filename = path.basename(url)
    const filePath = path.join(publicFontsDir, filename)
    try {
      const buffer = await fs.readFile(filePath)
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => buffer.buffer, // Node Buffer to ArrayBuffer
      } as Response
    } catch (e) {
      console.error(`[MockFetch] Failed to read font: ${filePath}`, e)
      return { ok: false, status: 404, statusText: 'Not Found' } as Response
    }
  }
  return { ok: false, status: 404, statusText: 'Not Found' } as Response
}

// Mock Blob (simple version sufficient for pdf-lib output)
class MockBlob {
  private parts: any[]
  constructor(parts: any[], options?: any) {
    this.parts = parts
  }
  async arrayBuffer() {
    // Assuming parts[0] is Uint8Array from pdf-lib
    return this.parts[0].buffer
  }
}
global.Blob = MockBlob as any

// --- Main ---

async function run() {
  console.log('📄 Loading fixture...')
  const fixturePath = path.join(process.cwd(), 'fixtures/sample-worksheet.json')
  const worksheetJson = await fs.readFile(fixturePath, 'utf-8')
  const worksheet: Worksheet = JSON.parse(worksheetJson)
  
  const payload: GeneratePayload = {
      subject: worksheet.subject,
      grade: parseInt(worksheet.grade) || 2, // approximate
      topic: worksheet.topic
  }

  // 1. Server PDF
  console.log('🖥️ Generating Server PDF...')
  try {
    const base64 = await buildServerPdf(worksheet, payload)
    const buffer = Buffer.from(base64, 'base64')
    await fs.writeFile('tmp/server.pdf', buffer)
    console.log('✅ Saved tmp/server.pdf')
  } catch (e) {
    console.error('❌ Server PDF failed:', e)
  }

  // 2. Client PDF
  console.log('💻 Generating Client PDF...')
  try {
    const blob = await buildClientPdf(worksheet)
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile('tmp/client.pdf', buffer)
    console.log('✅ Saved tmp/client.pdf')
  } catch (e) {
    console.error('❌ Client PDF failed:', e)
  }
}

run().catch(console.error)
