import { useEffect, useState } from "react";
import { formatPhoneInput } from "@/lib/phone";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAssignableRecruiters,
  createApplicantManual,
  checkApplicantDuplicate,
  type ApplicantDuplicate,
} from "@/lib/portal.functions";
import { Modal, Field, Input, Select, Textarea, FormGrid, Button } from "@/components/portal/ui";

export function AddApplicantModal({
  defaultStageId,
  onClose,
  onCreated,
}: {
  defaultStageId?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const ctxFn = useServerFn(getAssignableRecruiters);
  const createFn = useServerFn(createApplicantManual);
  const dupeFn = useServerFn(checkApplicantDuplicate);
  const ctxQ = useQuery({ queryKey: ["assignable"], queryFn: () => ctxFn() });

  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    state: "",
    licensed: false,
    instagram_handle: "",
    assigned_recruiter_id: "",
    referred_by_profile_id: "",
    team_id: "",
    source_id: "",
    stage_id: defaultStageId ?? "",
    priority: "normal" as "low" | "normal" | "high",
    next_follow_up_at: "",
    notes: "",
    why_text: "",
  });
  const [error, setError] = useState("");
  const [dupe, setDupe] = useState<ApplicantDuplicate | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const ctx = ctxQ.data;
  const assigned = f.assigned_recruiter_id || ctx?.defaultRecruiterId || "";

  // Debounced duplicate lookup as soon as there is enough to match on.
  useEffect(() => {
    const email = f.email.trim();
    const phone = f.phone.trim();
    if (!email.includes("@") && phone.replace(/\D/g, "").length < 10) {
      setDupe(null);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const res = await dupeFn({
          data: { email, phone, last_name: f.last_name.trim() },
        });
        if (live) {
          setDupe(res.found ? res : null);
          setConfirmed(false);
        }
      } catch {
        /* a failed check never blocks the form */
      }
    }, 500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [f.email, f.phone, f.last_name, dupeFn]);

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...f,
          state: f.state.toUpperCase(),
          assigned_recruiter_id: assigned,
          confirm_duplicate: confirmed,
          next_follow_up_at: f.next_follow_up_at ? new Date(f.next_follow_up_at).toISOString() : "",
        } as any,
      }),
    onSuccess: (res: { id: string }) => onCreated(res.id),
    onError: (e: unknown) => {
      const msg = (e as Error).message || "Could not add applicant.";
      if (msg.includes("DUPLICATE:")) {
        const [, id, ...rest] = msg.slice(msg.indexOf("DUPLICATE:") + 10).split(":");
        setDupe({ found: true, id, name: rest.join(":") || "An existing applicant" });
        setError("");
        return;
      }
      setError(msg);
    },
  });

  const blocked = !!dupe && !confirmed;
  const disabled =
    mut.isPending ||
    blocked ||
    !f.first_name.trim() ||
    !f.last_name.trim() ||
    !f.email.trim() ||
    !assigned;


  return (
    <Modal
      title="Add applicant"
      description="Manually add an applicant to your CRM and pipeline."
      onClose={onClose}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => mut.mutate()} disabled={disabled}>
            {mut.isPending ? "Adding…" : "Add applicant"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <FormGrid>
          <Field label="First name" required>
            <Input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </Field>
          <Field label="Last name" required>
            <Input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={f.phone} onChange={(e) => set("phone", formatPhoneInput(e.target.value))} />
          </Field>
          <Field label="State">
            <Input maxLength={2} value={f.state} onChange={(e) => set("state", e.target.value)} />
          </Field>
          <Field label="Instagram">
            <Input value={f.instagram_handle} onChange={(e) => set("instagram_handle", e.target.value)} />
          </Field>
          <Field label="Assign to" required>
            <Select value={assigned} onChange={(e) => set("assigned_recruiter_id", e.target.value)}>
              {(ctx?.recruiters ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Referring recruiter">
            <Select
              value={f.referred_by_profile_id}
              onChange={(e) => set("referred_by_profile_id", e.target.value)}
            >
              <option value="">— same as assigned —</option>
              {(ctx?.recruiters ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Team">
            <Select value={f.team_id} onChange={(e) => set("team_id", e.target.value)}>
              <option value="">— none —</option>
              {(ctx?.teams ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source">
            <Select value={f.source_id} onChange={(e) => set("source_id", e.target.value)}>
              <option value="">— default —</option>
              {(ctx?.sources ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pipeline stage">
            <Select value={f.stage_id} onChange={(e) => set("stage_id", e.target.value)}>
              <option value="">New Applicant (default)</option>
              {(ctx?.stages ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => set("priority", e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </Field>
          <Field label="Next follow-up">
            <Input
              type="date"
              value={f.next_follow_up_at}
              onChange={(e) => set("next_follow_up_at", e.target.value)}
            />
          </Field>
        </FormGrid>
        <Field label="Why they want to work with Vantage">
          <Textarea rows={2} value={f.why_text} onChange={(e) => set("why_text", e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        {error && (
          <div
            className="rounded-[10px] border px-3 py-2 text-[13px]"
            style={{ borderColor: "var(--p-red)", background: "rgba(220,106,98,0.1)", color: "var(--p-red)" }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
