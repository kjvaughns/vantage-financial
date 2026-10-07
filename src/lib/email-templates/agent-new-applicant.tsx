import * as React from 'react'
import { Hr, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { GoldButton, Shell, greet, paragraph } from './_shell'

interface Props {
  /** Agent's first name. */
  agentName?: string
  applicantName?: string
  applicantEmail?: string
  applicantPhone?: string
  state?: string
  licensed?: boolean
  hasDownlines?: boolean
  instagramHandle?: string
  whyText?: string
  /** Pre-formatted schedule line: a CT date/time, a 1:1 request, or "Not scheduled yet". */
  scheduleLabel?: string
  referredByName?: string
  applicantUrl?: string
  agencyTrack?: 'builder' | 'owner'
}

const rowLabel: React.CSSProperties = {
  margin: '0',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#8C8A84',
}

const rowValue: React.CSSProperties = {
  margin: '2px 0 14px 0',
  fontSize: '15px',
  lineHeight: '1.5',
  color: '#F5F1E6',
}

const Row = ({ label, value }: { label: string; value?: string }) =>
  value && value.trim() ? (
    <>
      <Text style={rowLabel}>{label}</Text>
      <Text style={rowValue}>{value}</Text>
    </>
  ) : null

const Email = ({
  agentName,
  applicantName,
  applicantEmail,
  applicantPhone,
  state,
  licensed,
  hasDownlines,
  instagramHandle,
  whyText,
  scheduleLabel,
  referredByName,
  applicantUrl,
  agencyTrack,
}: Props) => {
  const title = `${agencyTrack ? 'New agency lead' : 'New applicant'} — ${applicantName || 'someone just applied'}`
  return (
    <Shell
      preview={title}
      title={agencyTrack ? "You have a new agency lead" : "You have a new applicant"}
      footerNote="You're receiving this because you're the recruiting agent on this applicant."
    >
      <Text style={paragraph}>
        {greet(agentName)} — {applicantName || 'a new applicant'} just submitted an application
        under you. Here&apos;s everything they gave us.
      </Text>
      <Hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '18px 0' }} />
      <Row label="Name" value={applicantName} />
      <Row label="Agency path" value={agencyTrack === 'owner' ? 'Owner' : agencyTrack === 'builder' ? 'Builder' : undefined} />
      <Row
        label="License status"
        value={
          licensed
            ? hasDownlines
              ? 'Licensed — bringing downlines with them'
              : 'Licensed'
            : 'Unlicensed'
        }
      />
      <Row label="Scheduled" value={scheduleLabel} />
      <Row label="Email" value={applicantEmail} />
      <Row label="Phone" value={applicantPhone} />
      <Row label="State" value={state} />
      <Row label="Instagram" value={instagramHandle} />
      <Row label="Watched VSL" value="Not yet — they were asked to watch before the 1:1" />
      <Row label="Referred by" value={referredByName} />
      <Row label="Why they applied" value={whyText} />
      {applicantUrl ? <GoldButton href={applicantUrl} label="Open in the portal" /> : null}
      <Text style={paragraph}>
        Reach out today — speed to contact is the whole game. Confirm they&apos;re booked and make
        sure they know what happens next.
      </Text>
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${d?.agencyTrack ? 'New agency lead' : 'New applicant'}: ${d?.applicantName || 'someone just applied'}${
      d?.licensed ? ' (licensed)' : ''
    }`,
  displayName: 'New applicant — agent alert',
  previewData: {
    agentName: 'Kevin',
    applicantName: 'Jordan Miller',
    applicantEmail: 'jordan@example.com',
    applicantPhone: '(555) 010-2030',
    state: 'TX',
    licensed: false,
    instagramHandle: '@jordanm',
    whyText: 'I want to build something of my own and help families get protected.',
    scheduleLabel: 'Monday, August 17 at 7:00 PM CT',
    referredByName: 'Kevin Vaughns',
    applicantUrl: 'https://vantage-financial.net/portal/crm',
  },
} satisfies TemplateEntry
