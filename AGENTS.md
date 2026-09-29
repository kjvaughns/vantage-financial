<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the applicant email catalog in `src/lib/email/catalog.ts` as the live delivery source, because the older JSX email templates are not used by the current dispatcher.
- Reschedule applicant interviews through a confirmation-token page and Cal.com booking UID, because creating a second booking would leave the original calendar event active.
