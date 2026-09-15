import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

type ResendEvent = {
  type?: string
  data?: {
    email_id?: string
    from?: string
    to?: string[]
    subject?: string
  }
}

type ReceivedEmail = {
  id?: string
  from?: string
  to?: string[]
  subject?: string
  text?: string | null
  html?: string | null
  message_id?: string | null
}

const ALLOWED_ADDRESSES = new Set([
  'support@cramloop.app',
  'privacy@cramloop.app',
  'security@cramloop.app',
])

function verifyWebhook(payload: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) return false

  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatureHeader = headers.get('svix-signature')
  if (!id || !timestamp || !signatureHeader) return false

  const numericTimestamp = Number(timestamp)
  if (!Number.isFinite(numericTimestamp)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - numericTimestamp) > 300) return false

  const encodedSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(encodedSecret, 'base64')
  } catch {
    return false
  }

  const expected = createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${payload}`)
    .digest()

  return signatureHeader
    .split(' ')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => {
      const [version, signature] = entry.split(',', 2)
      if (version !== 'v1' || !signature) return false
      try {
        const actual = Buffer.from(signature, 'base64')
        return actual.length === expected.length && timingSafeEqual(actual, expected)
      } catch {
        return false
      }
    })
}

function emailAddress(value?: string | null) {
  const raw = value?.trim() ?? ''
  const match = raw.match(/<([^>]+)>/)
  return (match?.[1] ?? raw).trim().toLowerCase()
}

async function getReceivedEmail(emailId: string, apiKey: string): Promise<ReceivedEmail | null> {
  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    console.error('Unable to retrieve CramLoop inbound email:', response.status)
    return null
  }

  return (await response.json()) as ReceivedEmail
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (!verifyWebhook(rawBody, request.headers)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  let event: ResendEvent
  try {
    event = JSON.parse(rawBody) as ResendEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  if (event.type !== 'email.received') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const forwardTo = process.env.CRAMLOOP_FORWARD_TO?.trim()
  if (!apiKey || !forwardTo) {
    console.error('CramLoop inbound forwarding is missing required environment variables.')
    return NextResponse.json({ error: 'Inbound forwarding is not configured.' }, { status: 503 })
  }

  const emailId = event.data?.email_id?.trim()
  if (!emailId) return NextResponse.json({ error: 'Missing email ID.' }, { status: 400 })

  const received = await getReceivedEmail(emailId, apiKey)
  if (!received) return NextResponse.json({ error: 'Unable to retrieve email.' }, { status: 502 })

  const inboundAddress = (received.to ?? event.data?.to ?? [])
    .map(emailAddress)
    .find((address) => ALLOWED_ADDRESSES.has(address))

  if (!inboundAddress) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'Unknown recipient.' })
  }

  const sender = received.from ?? event.data?.from ?? 'Unknown sender'
  const senderAddress = emailAddress(sender)
  const subject = (received.subject ?? event.data?.subject ?? 'CramLoop email').trim()
  const bodyText = (received.text ?? '').trim()
  const bodyHtml = received.html ?? undefined
  const label = inboundAddress.split('@')[0]

  const forwardResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `CramLoop ${label[0].toUpperCase()}${label.slice(1)} <${inboundAddress}>`,
      to: [forwardTo],
      subject: `[CramLoop ${label}] ${subject}`,
      text: `From: ${sender}\nTo: ${inboundAddress}\n\n${bodyText || 'HTML-only message. See the HTML version of this forwarded email.'}`,
      ...(bodyHtml ? { html: `<p><strong>From:</strong> ${sender.replace(/[<>&]/g, '')}<br/><strong>To:</strong> ${inboundAddress}</p><hr/>${bodyHtml}` } : {}),
      ...(senderAddress ? { reply_to: senderAddress } : {}),
      tags: [
        { name: 'product', value: 'cramloop' },
        { name: 'category', value: 'inbound-forward' },
        { name: 'mailbox', value: label },
      ],
    }),
    cache: 'no-store',
  })

  if (!forwardResponse.ok) {
    console.error('Unable to forward CramLoop inbound email:', forwardResponse.status)
    return NextResponse.json({ error: 'Unable to forward email.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, forwarded: true, mailbox: inboundAddress })
}
