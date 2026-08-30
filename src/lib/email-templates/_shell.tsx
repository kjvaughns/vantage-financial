import * as React from 'react'
import { DISCORD_INVITE_URL, INSTAGRAM_URL, XCEL_COURSE_URL } from '@/lib/next-steps'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const GOLD = '#C9A84C'
export const CARD = '#141414'
export const INK = '#F5F1E6'
export const MUTED = '#B8B4A8'
export const FAINT = '#8C8A84'

/** Links used across the Vantage emails. All optional with safe fallbacks. */
export interface EmailLinkProps {
  overviewUrl?: string
  ownerCalendlyUrl?: string
  courseUrl?: string
  discordInviteUrl?: string
  /**
   * When set, this render is the recruiting agent's copy of an email that was
   * sent to the named applicant. Shell renders a banner saying so.
   */
  copyFor?: string
}


type ResolvedLinks = Required<Omit<EmailLinkProps, 'copyFor'>>

export const FALLBACK_LINKS: ResolvedLinks = {
  overviewUrl: 'https://vantage-financial.net/apply',
  ownerCalendlyUrl: 'https://vantage-financial.net/apply',
  courseUrl: XCEL_COURSE_URL,
  discordInviteUrl: DISCORD_INVITE_URL,
}


const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: 0,
  padding: '28px 12px',
  fontFamily: 'Arial, Helvetica, sans-serif',
}

const card: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  backgroundColor: CARD,
  borderRadius: '16px',
  overflow: 'hidden',
}

const inner: React.CSSProperties = { padding: '30px 34px 26px 34px' }

const wordmark: React.CSSProperties = {
  margin: '0 0 6px 0',
  letterSpacing: '3px',
  fontSize: '15px',
  fontWeight: 800,
  color: GOLD,
}

const footerStyle: React.CSSProperties = {
  padding: '18px 34px 28px 34px',
  fontSize: '12px',
  lineHeight: '1.6',
  color: FAINT,
  margin: 0,
}

const socialStyle: React.CSSProperties = {
  padding: '0 34px 26px 34px',
  margin: 0,
  fontSize: '12px',
  lineHeight: '1.6',
}

const socialLink: React.CSSProperties = {
  color: GOLD,
  textDecoration: 'none',
  fontWeight: 700,
}

const hr: React.CSSProperties = {
  borderColor: 'rgba(255,255,255,0.09)',
  margin: 0,
}

export const heading: React.CSSProperties = {
  margin: '6px 0 14px 0',
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: '26px',
  lineHeight: '1.15',
  color: INK,
}

export const paragraph: React.CSSProperties = {
  margin: '0 0 14px 0',
  fontSize: '15px',
  lineHeight: '1.6',
  color: MUTED,
}

export const bullet: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '14.5px',
  lineHeight: '1.5',
  color: INK,
}

export const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: GOLD,
  borderRadius: '10px',
  padding: '14px 26px',
  fontSize: '15px',
  fontWeight: 700,
  color: '#141414',
  textDecoration: 'none',
}

export function GoldButton({ href, label }: { href: string; label: string }) {
  return (
    <Section style={{ margin: '20px 0' }}>
      <Button href={href} style={buttonStyle}>
        {label} &rarr;
      </Button>
    </Section>
  )
}

const copyBanner: React.CSSProperties = {
  margin: '0 0 18px 0',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(201,168,76,0.4)',
  backgroundColor: 'rgba(201,168,76,0.10)',
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#B8B4A8',
}

const discordBox: React.CSSProperties = {
  margin: '0 34px 24px 34px',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(201,168,76,0.35)',
  backgroundColor: 'rgba(201,168,76,0.08)',
}

const discordText: React.CSSProperties = {
  margin: 0,
  fontSize: '13.5px',
  lineHeight: '1.6',
  color: MUTED,
}

/** Standing Discord invite shown at the bottom of every applicant email. */
export function DiscordInvite({ href }: { href: string }) {
  return (
    <Section style={discordBox}>
      <Text style={discordText}>
        Not in the Vantage Discord yet? That&apos;s where training, announcements, and the team
        live &mdash;{' '}
        <a href={href} style={{ color: GOLD, textDecoration: 'underline', fontWeight: 700 }}>
          join the Vantage Discord
        </a>
        .
      </Text>
    </Section>
  )
}

export function Shell({
  preview,
  title,
  footerNote,
  copyFor,
  prefsUrl,
  hideSocial,
  discordUrl,
  children,
}: {
  preview: string
  title: string
  /** Overrides the default recruiting footer line (use for account/auth emails). */
  footerNote?: string
  /** Recruiting agent's copy — names the applicant this email went to. */
  copyFor?: string
  /** Optional emails link here so recipients can manage their categories. */
  prefsUrl?: string
  /** Security/account emails hide the social footer. */
  hideSocial?: boolean
  /** When set, a standing Discord invite renders above the footer. */
  discordUrl?: string
  children: React.ReactNode
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{copyFor ? `Copy — sent to ${copyFor}: ${preview}` : preview}</Preview>
      <Body style={main}>
        <Container style={card}>
          <Section style={inner}>
            <Text style={wordmark}>VANTAGE FINANCIAL</Text>
            {copyFor ? (
              <Text style={copyBanner}>
                Your copy — this email was just sent to <strong>{copyFor}</strong>. No action needed
                unless you want to follow up.
              </Text>
            ) : null}
            <Heading style={heading}>{title}</Heading>
            {children}
          </Section>
          {discordUrl ? <DiscordInvite href={discordUrl} /> : null}
          <Hr style={hr} />
          <Text style={footerStyle}>
            &copy; 2026 Vantage Financial.{' '}
            {footerNote ??
              (copyFor
                ? "You're receiving this because you're the recruiting agent on this applicant."
                : "You're receiving this because you applied to join the Vantage team.")}
            {prefsUrl ? (
              <>
                {' '}
                <a href={prefsUrl} style={{ color: GOLD, textDecoration: 'underline' }}>
                  Manage email preferences
                </a>
                .
              </>
            ) : null}
          </Text>
          {hideSocial ? null : (
            <Text style={socialStyle}>
              <a href={INSTAGRAM_URL} style={socialLink}>
                Follow @vantage.financial on Instagram
              </a>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  )
}

export { INSTAGRAM_URL }

export function greet(name?: string) {
  return name && name.trim() ? name.trim() : 'there'
}

export function links(p: EmailLinkProps): ResolvedLinks {
  const pick = (v: string | undefined, fallback: string) =>
    v && v.trim() && v.trim() !== "#" ? v.trim() : fallback;
  return {
    overviewUrl: pick(p.overviewUrl, FALLBACK_LINKS.overviewUrl),
    ownerCalendlyUrl: pick(p.ownerCalendlyUrl, FALLBACK_LINKS.ownerCalendlyUrl),
    courseUrl: pick(p.courseUrl, FALLBACK_LINKS.courseUrl),
    discordInviteUrl: pick(p.discordInviteUrl, FALLBACK_LINKS.discordInviteUrl),
  }
}
