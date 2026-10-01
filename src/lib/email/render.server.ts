/**
 * Server-side email renderer. One path for every Vantage email:
 * catalog copy -> admin override -> variable interpolation -> branded shell.
 *
 * Lines whose tokens can't be filled are dropped rather than shipped with a
 * visible `{{token}}`. Server-only (React Email render).
 */

import * as React from "react";
import { render } from "@react-email/render";

import { GenericEmail } from "@/lib/email-templates/generic";
import { AGENCY_NAME, interpolate, interpolateStrict, type EmailContext } from "./vars";
import { emailLinks } from "./links";
import { templateDef, type EmailTemplateDef } from "./catalog";

/** Admin copy override stored in `email_templates`. */
export interface TemplateOverride {
  subject?: string | null;
  title?: string | null;
  intro?: string | null;
  /** One paragraph per line. */
  body?: string | null;
  note?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  secondary_cta_label?: string | null;
  secondary_cta_url?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** Tokens that couldn't be resolved (diagnostics only). */
  missing: string[];
}

export interface RenderOptions {
  context?: EmailContext;
  override?: TemplateOverride | null;
  /** Recruiting agent's copy — banner names the applicant. */
  copyFor?: string | null;
}

function footerNote(def: EmailTemplateDef): string {
  if (def.category === "security") {
    return "This is a security notification for your Vantage Financial account.";
  }
  if (def.audience === "agent") {
    return "You're receiving this because you're part of the Vantage Financial team.";
  }
  return "You're receiving this because you applied to join the Vantage team.";
}

/**
 * Every applicant email invites them to the Discord. Suppressed when the email
 * already links there, so nobody gets the same link twice.
 */
function discordInvite(
  def: EmailTemplateDef,
  ctx: EmailContext,
  usedCopy: Array<string | null | undefined>,
): string | undefined {
  if (def.audience !== "applicant") return undefined;
  if (def.category === "security") return undefined;
  const url = ctx.discord_link;
  if (!url) return undefined;
  const already = usedCopy.some(
    (v) => typeof v === "string" && (v.includes(url) || v.includes("{{discord_link}}")),
  );
  return already ? undefined : url;
}

function splitParagraphs(value?: string | null): string[] | undefined {
  if (!value || !value.trim()) return undefined;
  return value
    .split(/\n{1,}/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function renderEmail(
  templateName: string,
  options: RenderOptions = {},
): Promise<RenderedEmail> {
  const def = templateDef(templateName);
  if (!def) throw new Error(`Unknown email template: ${templateName}`);

  const ctx: EmailContext = {
    agency_name: AGENCY_NAME,
    ...emailLinks(),
    ...(options.context ?? {}),
  };
  if (!ctx.first_name && ctx.full_name) ctx.first_name = ctx.full_name.split(/\s+/)[0];
  if (!ctx.first_name) ctx.first_name = "there";

  const o = options.override ?? {};
  const missing = new Set<string>();

  const subjectRaw = (o.subject && o.subject.trim()) || def.subject;
  const subjectResult = interpolate(subjectRaw, ctx);
  subjectResult.missing.forEach((m) => missing.add(m));

  const titleRaw = (o.title && o.title.trim()) || def.body.title;
  const titleResult = interpolate(titleRaw, ctx);
  titleResult.missing.forEach((m) => missing.add(m));

  const introRaw = o.intro !== undefined && o.intro !== null ? o.intro : def.body.intro;
  const overrideLines = splitParagraphs(o.body);
  const lineSource = overrideLines ?? def.body.lines ?? [];

  const keep = (value?: string | null) => {
    const out = interpolateStrict(value, ctx);
    if (value && !out) {
      for (const t of interpolate(value, ctx).missing) missing.add(t);
    }
    return out;
  };

  const lines = lineSource.map(keep).filter((v): v is string => !!v);
  const bullets = (def.body.bullets ?? []).map(keep).filter((v): v is string => !!v);
  const details = (def.body.details ?? [])
    .map((d) => {
      const value = keep(d.value);
      return value ? { label: keep(d.label) ?? d.label, value } : null;
    })
    .filter((d): d is { label: string; value: string } => !!d);

  const ctaLabel = (o.cta_label && o.cta_label.trim()) || def.body.ctaLabel;
  const ctaUrl = keep((o.cta_url && o.cta_url.trim()) || def.body.ctaUrl);
  const secondaryCtaLabel = (o.secondary_cta_label && o.secondary_cta_label.trim()) || def.body.secondaryCtaLabel;
  const secondaryCtaUrl = keep((o.secondary_cta_url && o.secondary_cta_url.trim()) || def.body.secondaryCtaUrl);
  const noteRaw = o.note !== undefined && o.note !== null ? o.note : def.body.note;

  const element = React.createElement(GenericEmail, {
    title: titleResult.text,
    preview: subjectResult.text,
    intro: keep(introRaw) ?? undefined,
    lines,
    bullets,
    details,
    ctaLabel: ctaUrl ? ctaLabel : undefined,
    ctaUrl: ctaUrl ?? undefined,
    secondaryCtaLabel: secondaryCtaUrl ? secondaryCtaLabel : undefined,
    secondaryCtaUrl: secondaryCtaUrl ?? undefined,
    note: keep(noteRaw) ?? undefined,
    footerNote: footerNote(def),
    prefsUrl: def.prefKey && !def.hideSupplementalLinks ? (ctx.preferences_link ?? undefined) : undefined,
    copyFor: options.copyFor ?? undefined,
    hideSocial: def.category === "security" || def.hideSupplementalLinks,
    discordUrl: def.hideSupplementalLinks
      ? undefined
      : discordInvite(def, ctx, [
          ctaUrl,
          secondaryCtaUrl,
          noteRaw,
          ...lines,
          ...bullets,
          ...details.map((d) => d.value),
        ]),
  });

  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  return {
    subject: subjectResult.text,
    html,
    text,
    missing: [...missing],
  };
}
