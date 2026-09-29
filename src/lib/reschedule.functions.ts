import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.string().min(10).max(128);

/** Only return booking details to someone holding this applicant's private link. */
export const getRescheduleDetails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("applicants")
      .select("id, first_name, scheduled_event_start, requested_overview_at, scheduling_status")
      .eq("confirmation_token", data.token).is("archived_at", null).maybeSingle();
    if (!row) return { found: false as const };
    return { found: true as const, firstName: row.first_name, currentTime: row.scheduled_event_start ?? row.requested_overview_at, status: row.scheduling_status };
  });

export const chooseNewInterviewTime = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema, startIso: z.string().datetime({ offset: true }) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchCalSlots, createCalBooking, rescheduleCalBooking } = await import("@/lib/calcom.server");
    const { data: a, error } = await supabaseAdmin.from("applicants")
      .select("id, first_name, last_name, email, phone, licensed, state, scheduled_event_id, scheduled_event_start, scheduling_status")
      .eq("confirmation_token", data.token).is("archived_at", null).maybeSingle();
    if (error || !a) return { ok: false as const, error: "This interview link is invalid. Please reply to your application email." };
    if (a.scheduled_event_start && !a.scheduled_event_id) {
      return { ok: false as const, error: "This interview was booked before online changes were available. Please reply to your interview email so we can move it without creating a second booking." };
    }
    const start = new Date(data.startIso);
    if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() + 10 * 60_000 || start.getTime() > Date.now() + 7 * 86400_000) {
      return { ok: false as const, error: "Please choose an available time in the next seven days." };
    }
    const slots = await fetchCalSlots();
    if (!slots.some((slot) => new Date(slot.startIso).getTime() === start.getTime())) {
      return { ok: false as const, error: "That time is no longer available. Please refresh and choose another." };
    }

    const booked = a.scheduled_event_id
      ? await rescheduleCalBooking(a.scheduled_event_id, start.toISOString(), a.email)
      : await createCalBooking({
          startIso: start.toISOString(), name: `${a.first_name} ${a.last_name}`.trim(),
          email: a.email, phone: a.phone, licensed: a.licensed, notes: `Rescheduled applicant · State: ${a.state ?? "not provided"}`,
        });
    if (!booked.ok) return { ok: false as const, error: booked.error };
    const uid = booked.uid || a.scheduled_event_id;
    const { error: saveError } = await supabaseAdmin.from("applicants").update({
      scheduled_event_id: uid,
      scheduled_event_start: start.toISOString(),
      scheduled_event_url: "rescheduleUrl" in booked && booked.rescheduleUrl ? booked.rescheduleUrl : uid ? `https://cal.com/reschedule/${encodeURIComponent(uid)}` : null,
      requested_overview_at: start.toISOString(),
      calendly_scheduled_at: start.toISOString(),
      scheduling_status: "scheduled",
    }).eq("id", a.id);
    if (saveError) {
      console.error("Interview rescheduled in Cal.com but CRM update failed", saveError);
      return { ok: false as const, error: "Your calendar time changed, but we couldn't update our records. Please reply to your interview email so we can confirm it." };
    }

    const { startSequence, stopSequence, loadApplicant, sendApplicantEmail } = await import("@/lib/recruiting/stage-engine.server");
    try {
      await stopSequence(a.id, "no_show_followup", "Interview rescheduled");
      await startSequence(a.id, "interview_reminders", start.toISOString());
      await supabaseAdmin.from("applicant_activities").insert({ applicant_id: a.id, event_type: "appointment_rescheduled", summary: `Interview moved to ${start.toISOString()}` });
      const applicant = await loadApplicant(a.id);
      if (applicant) await sendApplicantEmail(applicant, "reschedule-confirmation", { sendKey: `rescheduled:${a.id}:${start.toISOString()}` });
    } catch (followupError) {
      console.error("Interview booked but follow-up notification failed", followupError);
    }
    return { ok: true as const, startIso: start.toISOString() };
  });