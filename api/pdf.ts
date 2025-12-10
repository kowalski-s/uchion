import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing url query param' })
    return
  }

  const isProd = !!process.env.VERCEL
  let browser: any

  try {
    if (isProd) {
      const chromiumMod: any = await import('@sparticuz/chromium')
      const chromium = chromiumMod.default ?? chromiumMod
      const puppeteerCore = (await import('puppeteer-core')).default

      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      })
    } else {
      const puppeteerLocal = (await import('puppeteer')).default
      browser = await puppeteerLocal.launch({ headless: true })
    }

    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="worksheet.pdf"')
    res.status(200).send(pdfBuffer)
  } catch (error) {
    console.error('PDF Generation Error:', error)
    res.status(500).json({ error: 'Failed to generate PDF' })
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
