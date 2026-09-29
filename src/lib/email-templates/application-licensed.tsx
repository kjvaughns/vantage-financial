import * as React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { GoldButton, Shell, greet, links, paragraph, type EmailLinkProps } from './_shell'

interface Props extends EmailLinkProps {
  firstName?: string
}

const TITLE = "You're in — here's what happens next"

const Email = ({ firstName, ...rest }: Props) => {
  const L = links(rest)
  return (
    <Shell preview={TITLE} title={TITLE} copyFor={rest.copyFor}>
      <Text style={paragraph}>
        Hey {greet(firstName)}, we&apos;ve got your application — welcome.
      </Text>
      <Text style={paragraph}>
        Because you&apos;re already licensed, we skip the basics. Watch the short video first, then
        make sure your 1:1 interview is on the calendar:
      </Text>
      <GoldButton href="https://vantage-financial.net/watch" label="Watch before your call" />
      <GoldButton href={L.ownerCalendlyUrl} label="Book your 1:1 call" />
      <Text style={paragraph}>
        Have your NPN, the states and lines you&apos;re licensed for, your current carrier
        appointments and release status, and — if agents are coming with you — how many. We&apos;ll
        cover contracting, comp and lead flow on the call.
      </Text>
      <Text style={paragraph}>
        Then join the Vantage Discord — that&apos;s where training, carrier updates, and the team
        live:
      </Text>
      <GoldButton href={L.discordInviteUrl} label="Join the Discord" />
      <Text style={paragraph}>Let&apos;s move. See you soon.</Text>
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: TITLE,
  displayName: 'Application received — licensed',
  previewData: { firstName: 'Jordan' },
} satisfies TemplateEntry
