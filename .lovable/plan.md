# Academy: Starter Templates and Duplication

Finishes the last open piece of the onboarding/training plan: make Academy content as plug-and-play as onboarding now is.

## What gets built

### 1. Start from a template
In Academy management, each of the three sections (Recorded Presentations, Library, Courses) gets a "Start from a template" button. Picking a template creates a **draft** copy the admin then edits and publishes. Nothing goes live automatically.

- Course templates carry a full outline: title, description, instructor placeholders, what you'll learn, modules, lessons (video / text / resource / quiz placeholders) and quiz questions where included.
- Library templates create a set of draft items (script, playbook, worksheet, checklist) ready for the admin to attach files or links.
- Recording templates create a draft recording shell (title, topic, presenter placeholder, format) for the admin to paste a media link into.

Starter templates shipped with the build:
- New Agent Fast Start (course)
- Vantage Closer Course outline (course)
- Licensing & Getting Appointed (course)
- Core Scripts & Objections (library set)
- Weekly Team Training shell (recording)

Templates are stored as data, so more can be added later without code changes.

### 2. Manage templates
An admin "Templates" tab in Academy management: list of templates with kind, title, description, active/hidden, plus create, edit, duplicate and delete. Admins can also **save any existing course as a template** so a proven course becomes a reusable starting point.

### 3. Duplicate anything
Duplicate action on courses, library items and recordings (recordings and lessons already have it). Duplicates always land as drafts with "(copy)" appended, and a course duplicate copies its whole tree: modules, lessons and quiz questions. Learner progress is never copied.

### 4. Small consistency fixes in the same pass
- Library rows get the same inline row actions as recordings (publish/unpublish, duplicate, delete).
- Courses list gets inline publish/unpublish and duplicate.
- Plain-language help text on the Templates tab explaining templates vs duplicates.

## Technical notes

- Uses the existing `academy_templates` table (slug, kind, title, description, payload jsonb, is_active); its payload shape is defined per kind and validated with Zod on apply.
- New server functions in `src/lib/academy-content.functions.ts` / `src/lib/academy.functions.ts`: `adminListTemplates`, `adminUpsertTemplate`, `adminDeleteTemplate`, `adminApplyTemplate`, `adminSaveCourseAsTemplate`, `adminDuplicateCourse`, `adminDuplicateLibraryItem` — all behind the existing `requireSupabaseAuth` + `assertCanManage` guard.
- Starter templates are inserted as data rows (seeded once, `is_active`), so the shipped set is editable like any other template.
- Template application is a single server-side transaction-style insert chain: course → modules → lessons → questions, all with `status: 'draft'` / `is_published: false`.
- UI added as a fourth section in `src/routes/_authenticated/portal/academy/admin.tsx` plus row actions in `courses-manager.tsx`, `library-manager.tsx`, `recordings-manager.tsx`, built only from `@/components/portal/ui`.
- No schema change expected beyond seeding rows; if `academy_templates` lacks a needed column a migration adds it with GRANTs, RLS and admin-manage / authenticated-read policies.

## Verification

As admin: apply each starter template, confirm a draft appears with the full structure, edit and publish it, duplicate a published course and confirm the copy is a draft with all lessons and questions, save a course as a template and re-apply it. As an agent: confirm no draft or template content is ever visible.
