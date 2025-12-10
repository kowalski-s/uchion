import chromium from "chrome-aws-lambda";
import puppeteer from "puppeteer-core";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing ?url parameter");
    }

    const executablePath = await chromium.executablePath;

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await page.goto(url as string, {
      waitUntil: "networkidle0",
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=worksheet.pdf");

    return res.send(pdf);
  } catch (error: any) {
    console.error("PDF Generation Error:", error);
    return res.status(500).send("PDF generation failed: " + error.message);
  }
}
