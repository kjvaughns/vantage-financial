import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  assignApplicantAgentLink,
  getApplicantAgentLinkOptions,
  saveAgentLink,
} from "@/lib/portal.functions";
import { Button, Field, Input, Modal, notify } from "@/components/portal/ui";

type LinkOption = { id: string; label: string; url: string; is_active: boolean };

/**
 * Popup for assigning an applicant's AgentLink contracting link. Shown when an
 * applicant enters the Onboarding stage, and re-openable from a reminder.
 * Links must belong to the applicant's upline; admins/uplines can add one inline.
 */
export function AssignContractingLinkModal({
  applicantId,
  applicantName,
  onClose,
  onDone,
}: {
  applicantId: string;
  applicantName?: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const fetchOptions = useServerFn(getApplicantAgentLinkOptions);
  const assignFn = useServerFn(assignApplicantAgentLink);
  const saveLinkFn = useServerFn(saveAgentLink);

  const optionsQ = useQuery({
    queryKey: ["applicant-agentlink-options", applicantId],
    queryFn: () => fetchOptions({ data: { applicant_id: applicantId } }),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["applicants"] });
    qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    qc.invalidateQueries({ queryKey: ["applicant-agentlink-options", applicantId] });
  };

  const assignMut = useMutation({
    mutationFn: (linkId: string) =>
      assignFn({ data: { applicant_id: applicantId, link_id: linkId } }),
    onSuccess: () => {
      invalidate();
      notify.success("Contracting link assigned.");
      onDone?.();
      onClose();
    },
    onError: (e: any) =>
      notify.error("Couldn't assign that link", e?.message ?? "Please try again."),
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const uplineId = optionsQ.data?.uplineId;
      if (!uplineId) throw new Error("No upline found for this applicant.");
      const created = (await saveLinkFn({
        data: { owner_id: uplineId, label: newLabel.trim(), url: newUrl.trim(), is_active: true },
      })) as { ok: boolean; id?: string };
      if (!created?.id) throw new Error("Link was saved but could not be selected.");
      await assignFn({ data: { applicant_id: applicantId, link_id: created.id } });
    },
    onSuccess: () => {
      invalidate();
      notify.success("Link added and assigned.");
      onDone?.();
      onClose();
    },
    onError: (e: any) => notify.error("Couldn't add that link", e?.message ?? "Check the URL and try again."),
  });

  const data = optionsQ.data;
  const links = (data?.links ?? []) as LinkOption[];
  const busy = assignMut.isPending || addMut.isPending;

  return (
    <Modal
      title="Assign contracting link"
      description={
        applicantName
          ? `${applicantName} is moving to Onboarding. Pick the AgentLink link they'll use to contract.`
          : "Pick the AgentLink link this recruit will use to contract."
      }
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Skip for now
          </Button>
          {!adding && (
            <Button
              variant="primary"
              size="sm"
              disabled={!selected || busy}
              loading={assignMut.isPending}
              onClick={() => selected && assignMut.mutate(selected)}
            >
              Assign link
            </Button>
          )}
        </div>
      }
    >
      {optionsQ.isLoading ? (
        <p className="p-secondary">Loading links…</p>
      ) : optionsQ.isError ? (
        <p className="p-secondary">Couldn't load the available links. Close and try again.</p>
      ) : !data?.uplineId ? (
        <p className="p-secondary">
          This applicant doesn't have an upline on record yet, so there's no link to assign. Set
          their recruiter first, then assign the link from their record.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="p-secondary">
            Upline: <span className="font-semibold" style={{ color: "var(--p-gold)" }}>{data.uplineName ?? "Unknown"}</span>
          </p>

          {links.length === 0 && !adding ? (
            <p className="p-secondary">
              {data.uplineName ?? "This upline"} doesn't have any active AgentLink links yet.
              {data.canAddLink ? " Add one below to assign it right away." : " Ask them to add one in their settings."}
            </p>
          ) : (
            !adding && (
              <div className="space-y-2">
                {links.map((link) => (
                  <label
                    key={link.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3"
                    style={{
                      borderColor:
                        selected === link.id ? "var(--p-gold-line)" : "var(--p-border)",
                      background:
                        selected === link.id ? "var(--p-gold-soft)" : "var(--p-raised)",
                    }}
                  >
                    <input
                      type="radio"
                      name="agentlink-link"
                      className="mt-0.5"
                      checked={selected === link.id}
                      onChange={() => setSelected(link.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold" style={{ color: "var(--p-text)" }}>
                        {link.label}
                      </span>
                      <span className="p-muted block truncate text-[12px]">{link.url}</span>
                    </span>
                  </label>
                ))}
              </div>
            )
          )}

          {data.canAddLink &&
            (adding ? (
              <div
                className="space-y-3 rounded-[10px] border p-3"
                style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}
              >
                <Field label="Link label" required>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Main contracting link"
                  />
                </Field>
                <Field label="AgentLink URL" required hint="The https:// contracting link from AgentLink.">
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://…"
                    inputMode="url"
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={addMut.isPending}
                    disabled={!newLabel.trim() || !newUrl.trim() || busy}
                    onClick={() => addMut.mutate()}
                  >
                    Add & assign
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                + Add a link for {data.uplineName ?? "this upline"}
              </Button>
            ))}
        </div>
      )}
    </Modal>
  );
}
