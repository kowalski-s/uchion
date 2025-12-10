import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Worksheet id is required' })
    return
  }

  // Get data from body if it's a POST request (preferred for large payloads)
  let dataParam = ''
  if (req.method === 'POST' && req.body && req.body.data) {
    dataParam = req.body.data
  }

  // Determine base URL dynamically to support Vercel deployments and local dev
  const protocol = req.headers['x-forwarded-proto'] ?? 'http'
  const host = req.headers.host
  const baseUrl = `${protocol}://${host}`
  
  // URL to the worksheet page in print/pdf mode
  // We append ?print=1 so the page knows to hide UI elements if needed
  // We also append &data=... if we have the worksheet data, so the page can hydrate from it
  let url = `${baseUrl}/worksheet/${id}?print=1&pdf=1`
  if (dataParam) {
    // Note: Puppeteer handles long URLs fine usually, but browsers have limits. 
    // Since we control the environment (Chromium), ~32KB URL should be safe enough for most worksheets.
    url += `&data=${encodeURIComponent(dataParam)}`
  }

  console.log(`Generating PDF for URL: ${url}`)

  let browser
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new',
    })

    const page = await browser.newPage()

    // Navigate to the page
    // waitUntil: 'networkidle0' ensures all requests are finished (e.g. fonts, images)
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60000, // 60 seconds timeout
    })

    // Emulate print media type to trigger @media print styles
    await page.emulateMediaType('print')

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true, // Print background colors/images
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="worksheet-${id}.pdf"`)
    res.status(200).end(pdfBuffer)
  } catch (error) {
    console.error('PDF Generation Error:', error)
    // Only send error JSON if headers haven't been sent yet
    if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate PDF', details: error instanceof Error ? error.message : String(error) })
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
