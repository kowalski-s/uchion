import chromium from 'chrome-aws-lambda'
import puppeteer from 'puppeteer-core'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).send('Missing Worksheet ID')
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
    let url = `${baseUrl}/worksheet/${id}?print=1&pdf=1`
    if (dataParam) {
      url += `&data=${encodeURIComponent(dataParam)}`
    }

    console.log(`Generating PDF for URL: ${url}`)

    const executablePath = await chromium.executablePath

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: executablePath || undefined, // Fallback to local chrome if null (in dev)
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    })

    const page = await browser.newPage()
    await page.goto(url, {
      waitUntil: 'networkidle0',
    })

    // Emulate print media type to trigger @media print styles
    await page.emulateMediaType('print')

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
    })

    await browser.close()

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="worksheet-${id}.pdf"`)
    return res.status(200).end(pdfBuffer)
  } catch (error) {
    console.error('PDF Generation Error:', error)
    return res.status(500).send('Failed to generate PDF')
  }
}
