import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

// Vercel Functions only support 'nodejs' (latest LTS) or 'edge'.
// Specific versions like 'nodejs18.x' are deprecated/unsupported in the config object.
export const config = {
  maxDuration: 60, // Increase timeout for PDF generation
}

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
    const isProd = !!process.env.VERCEL || process.env.NODE_ENV === 'production'

    if (isProd) {
      // Production: use @sparticuz/chromium
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      })
    } else {
      // Development: use local Chrome
      // Note: We need to specify 'channel' or 'executablePath' for puppeteer-core to find Chrome locally
      // If you have 'puppeteer' installed as a dev dependency, it downloads Chrome to a known location.
      // If not, you might need to point to your local Chrome installation.
      // Here we assume standard local Chrome availability or 'puppeteer' dev dependency.
      try {
          browser = await puppeteer.launch({
            channel: 'chrome',
            headless: true,
          })
      } catch (e) {
          // Fallback: try without channel (relies on CHROMIUM_PATH or similar)
          console.warn('Could not launch local Chrome with channel "chrome", trying default...', e)
          browser = await puppeteer.launch({
            headless: true,
          })
      }
    }

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
