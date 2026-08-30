/**
 * Canonical Vantage Financial team schedule (all times Central).
 * Single source of truth — the portal onboarding step and every email that
 * repeats the schedule read from here so the times can never drift again.
 */

export type ScheduleItem = {
  label: string;
  when: string;
  note?: string;
};

export const SCHEDULE: ScheduleItem[] = [
  { label: "Mandatory Team Meeting", when: "Monday 9:00 AM" },
  {
    label: "New Agent Live Training",
    when: "Daily 10:00 AM",
    note: "Training Room Discord voice channel",
  },
  { label: "Company Overview", when: "Monday 7:00 PM" },
  { label: "Agency Training", when: "Wednesday 10:30 AM" },
  {
    label: "Film Review",
    when: "Monday–Thursday 6:00 PM",
    note: "Training Room — mandatory for anyone who hasn't closed a deal that day",
  },
  { label: "Live Dials", when: "10:00 AM to 6:00 PM daily" },
];

/** One-line summary used inside email copy. */
export const SCHEDULE_SUMMARY =
  "Monday 9:00 AM team meeting, daily 10:00 AM new agent live training, Monday 7:00 PM company overview, Wednesday 10:30 AM agency training, film review Monday through Thursday 6:00 PM in the Training Room (mandatory if you haven't closed a deal that day), live dials 10-6 daily.";

/** Short bullets for emails that list only the essentials. */
export const SCHEDULE_BULLETS = [
  "Monday 9:00 AM team meeting",
  "Film review Monday through Thursday 6:00 PM — mandatory if you haven't closed that day",
];

export const MEETING_TIME = "Monday 9:00 AM CT";
export const AGENCY_TRAINING_TIME = "Wednesday 10:30 AM CT";
export const FILM_REVIEW_TIME = "Monday–Thursday 6:00 PM CT";
