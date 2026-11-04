import * as React from 'react'
import { Section, Text, Link } from '@react-email/components'
import { SARAH } from '@/lib/sarah-support'

import { GoldButton, INK, MUTED, Shell, bullet, paragraph } from './_shell'

/** Fully-resolved copy for one email — no tokens left. */
export interface GenericEmailProps {
  title: string
  preview: string
  intro?: string
  lines?: string[]
  bullets?: string[]
  details?: Array<{ label: string; value: string }>
  ctaLabel?: string
  ctaUrl?: string
  secondaryCtaLabel?: string
  secondaryCtaUrl?: string
  note?: string
  footerNote?: string
  prefsUrl?: string
  copyFor?: string
  hideSocial?: boolean
  discordUrl?: string
  supportContact?: boolean
  supportLinks?: boolean
}

const detailRow: React.CSSProperties = {
  margin: '0 0 6px 0',
  fontSize: '14.5px',
  lineHeight: '1.5',
  color: INK,
}

const detailLabel: React.CSSProperties = {
  color: MUTED,
}

const detailBox: React.CSSProperties = {
  margin: '4px 0 18px 0',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.08)',
  backgroundColor: 'rgba(255,255,255,0.03)',
}

const noteStyle: React.CSSProperties = {
  margin: '14px 0 0 0',
  fontSize: '13.5px',
  lineHeight: '1.6',
  color: MUTED,
}

/**
 * One component renders every Vantage email. Copy comes from the catalog
 * (with admin overrides applied and variables interpolated) so branding and
 * layout stay identical across the whole system.
 */
export function GenericEmail({
  title,
  preview,
  intro,
  lines,
  bullets,
  details,
  ctaLabel,
  ctaUrl,
  secondaryCtaLabel,
  secondaryCtaUrl,
  note,
  footerNote,
  prefsUrl,
  copyFor,
  hideSocial,
  discordUrl,
  supportContact,
  supportLinks,
}: GenericEmailProps) {
  return (
    <Shell
      preview={preview}
      title={title}
      footerNote={footerNote}
      prefsUrl={prefsUrl}
      copyFor={copyFor}
      hideSocial={hideSocial}
      discordUrl={discordUrl}
    >
      {intro ? <Text style={paragraph}>{intro}</Text> : null}
      {(lines ?? []).map((line, i) => (
        <Text key={`l${i}`} style={paragraph}>
          {line}
        </Text>
      ))}
      {details && details.length ? (
        <Section style={detailBox}>
          {details.map((d, i) => (
            <Text key={`d${i}`} style={detailRow}>
              <span style={detailLabel}>{d.label}: </span>
              <strong>{d.value}</strong>
            </Text>
          ))}
        </Section>
      ) : null}
      {(bullets ?? []).map((b, i) => (
        <Text key={`b${i}`} style={bullet}>
          • {b}
        </Text>
      ))}
      {ctaLabel && ctaUrl ? <GoldButton href={ctaUrl} label={ctaLabel} /> : null}
      {secondaryCtaLabel && secondaryCtaUrl ? (
        <GoldButton href={secondaryCtaUrl} label={secondaryCtaLabel} />
      ) : null}
      {note ? <Text style={noteStyle}>{note}</Text> : null}
      {supportContact ? <Section style={detailBox}>
        <Text style={detailRow}><strong>{SARAH.name}</strong><br />{SARAH.title}</Text>
        <Text style={detailRow}>{supportLinks ? <Link href={SARAH.sms}>Text Sarah: {SARAH.phone}</Link> : `Text Sarah: ${SARAH.phone}`}</Text>
        <Text style={detailRow}>{supportLinks ? <Link href={`mailto:${SARAH.email}`}>{SARAH.email}</Link> : SARAH.email}</Text>
      </Section> : null}
    </Shell>
  )
}

export default GenericEmail
