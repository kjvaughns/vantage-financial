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
        Your next step is the Vantage overview call. If you haven&apos;t booked it yet, grab a
        time here:
      </Text>
      <GoldButton href={L.overviewUrl} label="Book the overview" />
      <Text style={paragraph}>
        Because you&apos;re already licensed, you can also grab time for a quick 1:1 with the
        team to fast-track things if you&apos;d rather move now:
      </Text>
      <GoldButton href={L.ownerCalendlyUrl} label="Book a 1:1 call" />
      <Text style={paragraph}>
        Then join the Vantage Discord — that&apos;s where training, announcements, and the team
        live:
      </Text>
      <GoldButton href={L.discordInviteUrl} label="Join the Discord" />
      <Text style={paragraph}>Either way — let&apos;s move. See you soon.</Text>
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: TITLE,
  displayName: 'Application received — licensed',
  previewData: { firstName: 'Jordan' },
} satisfies TemplateEntry
