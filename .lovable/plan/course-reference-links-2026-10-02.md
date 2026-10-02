# Course reference links

Let admins attach any number of reference links to any course lesson (video, audio, text, resource, link, or quiz). Each link opens in a new tab.

## What you get

- **Lesson editor, "Reference links" section:** add, edit, reorder (up and down arrows) and remove links. Each link has:
  - Label (for example "Product comparison sheet")
  - Type: **External website** or **Page inside the portal**
  - For an external link: a web address (https:// is added automatically if you leave it out).
  - For a portal page: choose from a list (Dashboard, Applicants, Tasks, Calendar, Leaderboard, Onboarding, Academy, any published course, library item or recording), or type a portal path yourself.
  - Optional short note shown under the label.
- **Agent lesson view:** a "Reference links" card under the lesson content. Each link has an icon showing whether it is external or inside the portal, and every link opens in a new tab.
- Links are copied along when a lesson or course is duplicated or saved as a template.

## Technical details

- Migration: add `reference_links jsonb not null default '[]'` to `course_lessons` (additive, so existing lessons keep working). Each item looks like `{ label, kind: "external"|"internal", url, note? }`.
- `academy.functions.ts` lesson upsert: a zod array (up to 20 items). Internal paths must start with `/portal`. External links must use http or https. Include the links in the duplicate and template code paths.
- `courses-manager.tsx`: new `ReferenceLinksEditor` built from the existing portal UI kit. The internal-page picker is filled from the published courses, library items and recordings already loaded.
- `courses.$slug.tsx`: render the links card with `target="_blank" rel="noopener noreferrer"`.
- The existing single `resource_url` on link and resource lessons stays unchanged.
