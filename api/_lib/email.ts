/**
 * Email sending via Unisender Go transactional API.
 * Docs: https://godocs.unisender.ru/web-api-ref#email-send
 */

const UNISENDER_GO_URL = 'https://go1.unisender.ru/ru/transactional/api/v1/email/send.json'
const FROM_EMAIL = 'noreply@ychion.ru'
const FROM_NAME = 'Ychion'

interface SendEmailParams {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.UNISENDER_GO_API_KEY
  if (!apiKey) {
    throw new Error('[Email] UNISENDER_GO_API_KEY is not configured')
  }

  const body = {
    message: {
      recipients: [{ email: to }],
      body: {
        html,
        plaintext: text,
      },
      subject,
      from_email: FROM_EMAIL,
      from_name: FROM_NAME,
    },
  }

  const response = await fetch(UNISENDER_GO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown')
    console.error(`[Email] Unisender Go error: ${response.status}`, errorText)
    throw new Error(`Email send failed: ${response.status}`)
  }

  const result = await response.json() as { status: string }
  if (result.status !== 'success') {
    console.error('[Email] Unisender Go rejected:', result)
    throw new Error('Email send rejected by provider')
  }
}

export async function sendOTPEmail(email: string, code: string): Promise<void> {
  const subject = 'Код для входа в Ychion'

  const text = [
    `Ваш код для входа: ${code}`,
    '',
    'Код действителен 10 минут.',
    'Если вы не запрашивали код, просто проигнорируйте это письмо.',
    '',
    '— Команда Ychion',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
        <tr><td style="padding:32px 32px 24px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#0f172a">
            <span>Учи</span><span style="color:#8C52FF">Он</span>
          </div>
        </td></tr>
        <tr><td style="padding:0 32px;text-align:center">
          <p style="margin:0 0 8px;font-size:16px;color:#334155">Ваш код для входа:</p>
          <div style="display:inline-block;padding:16px 32px;background:#f5f3ff;border-radius:12px;margin:8px 0 16px">
            <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#8C52FF">${code}</span>
          </div>
          <p style="margin:0 0 4px;font-size:14px;color:#64748b">Код действителен 10 минут.</p>
          <p style="margin:0;font-size:13px;color:#94a3b8">Если вы не запрашивали код, проигнорируйте это письмо.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;text-align:center">
          <div style="border-top:1px solid #e2e8f0;padding-top:16px">
            <span style="font-size:12px;color:#94a3b8">ychion.ru</span>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await sendEmail({ to: email, subject, text, html })
}
