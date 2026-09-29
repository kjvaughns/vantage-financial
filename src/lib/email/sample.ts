/** Sample variable values for admin template previews. */

import { AGENCY_NAME, type EmailContext } from "./vars";
import { emailLinks } from "./links";

export function sampleContext(): EmailContext {
  return {
    agency_name: AGENCY_NAME,
    ...emailLinks(),
    reschedule_link: "https://vantage-financial.net/reschedule/sample-token",
    first_name: "Jordan",
    last_name: "Reyes",
    full_name: "Jordan Reyes",
    applicant_name: "Jordan Reyes",
    email: "jordan@example.com",
    phone: "(555) 214-8890",
    state: "TX",
    recruiter_name: "Kenneth Vaughns",
    sender_name: "Kenneth Vaughns",
    interview_date: "Monday, August 18",
    interview_time: "7:00 PM CT",
    interview_when: "Monday, August 18 at 7:00 PM CT",
    overview_date: "Monday, August 18",
    overview_time: "7:00 PM CT",
    overview_when: "Monday, August 18 at 7:00 PM CT",
    event_name: "Team meeting",
    event_when: "Monday at 7:00 PM CT",
    course_name: "Vantage Closer Course",
    deadline: "Friday, August 22",
    score: "88%",
    progress: "3 of 5 steps complete",
    next_step: "Agent Cloud onboarding",
    message: "Sample message body for this notification.",
    subject_line: "Team update",
    target: "20 dials before noon",
    dial_hours: "10:00 AM – 12:00 PM and 5:00 PM – 8:00 PM CT",
    mindset: "Activity is the only thing you control. Control it.",
    focus: "Slow down the needs analysis and let them talk.",
    meeting_time: "Monday 7:00 PM CT",
    training_time: "Wednesday 7:00 PM CT",
    film_review: "Thursday 7:00 PM CT",
    dial_expectation: "300 dials per week",
    tip_title: "Tonality",
    tip_body: "Your tone sells before your words do. Mirror their pace, drop your pitch on price.",
    invitation_link: "https://vantage-financial.net/portal-invite/sample-token",
    evaluation_link: "https://vantage-financial.net/evaluation",
  };
}
