import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listApplicants from "./tools/list-applicants";
import getApplicant from "./tools/get-applicant";
import createApplicant from "./tools/create-applicant";
import updateApplicant from "./tools/update-applicant";
import changeStage from "./tools/change-stage";
import addNote from "./tools/add-note";
import confirmCourse from "./tools/confirm-course";
import listAgents from "./tools/list-agents";
import pipelineSummary from "./tools/pipeline-summary";
import recentActivity from "./tools/recent-activity";
import trainingStatus from "./tools/training-status";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "vantage-financial",
  title: "Vantage Financial",
  version: "0.1.0",
  instructions:
    "Vantage Financial recruiting CRM. Search, read, create and update applicants, change pipeline stages, add notes, see agents and pipeline counts, and poll recent activity for new events. Acts with the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listApplicants, getApplicant, createApplicant, updateApplicant, changeStage,
    addNote, confirmCourse, listAgents, pipelineSummary, recentActivity, trainingStatus,
  ],
});
