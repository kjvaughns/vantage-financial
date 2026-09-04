export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applicant_action_tokens: {
        Row: {
          action: string
          applicant_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          action: string
          applicant_id: string
          created_at?: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          action?: string
          applicant_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicant_action_tokens_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      applicant_activities: {
        Row: {
          actor_id: string | null
          applicant_id: string
          created_at: string
          data: Json | null
          event_type: string
          id: string
          summary: string | null
        }
        Insert: {
          actor_id?: string | null
          applicant_id: string
          created_at?: string
          data?: Json | null
          event_type: string
          id?: string
          summary?: string | null
        }
        Update: {
          actor_id?: string | null
          applicant_id?: string
          created_at?: string
          data?: Json | null
          event_type?: string
          id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicant_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_activities_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      applicant_sequences: {
        Row: {
          anchor_at: string | null
          applicant_id: string
          created_at: string
          id: string
          kind: string
          next_send_at: string | null
          status: string
          stop_reason: string | null
          touch_count: number
          updated_at: string
        }
        Insert: {
          anchor_at?: string | null
          applicant_id: string
          created_at?: string
          id?: string
          kind: string
          next_send_at?: string | null
          status?: string
          stop_reason?: string | null
          touch_count?: number
          updated_at?: string
        }
        Update: {
          anchor_at?: string | null
          applicant_id?: string
          created_at?: string
          id?: string
          kind?: string
          next_send_at?: string | null
          status?: string
          stop_reason?: string | null
          touch_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicant_sequences_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      applicant_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
        }
        Relationships: []
      }
      applicant_stage_history: {
        Row: {
          applicant_id: string
          changed_by: string | null
          entered_at: string
          id: string
          stage_id: string | null
        }
        Insert: {
          applicant_id: string
          changed_by?: string | null
          entered_at?: string
          id?: string
          stage_id?: string | null
        }
        Update: {
          applicant_id?: string
          changed_by?: string | null
          entered_at?: string
          id?: string
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicant_stage_history_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_stage_history_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      applicants: {
        Row: {
          address: string | null
          archived_at: string | null
          assigned_manager_id: string | null
          assigned_recruiter_id: string | null
          calendly_scheduled_at: string | null
          calendly_url_used: string | null
          city: string | null
          confirmation_token: string | null
          consent_contact: boolean
          course_confirmed_at: string | null
          created_at: string
          current_stage_id: string | null
          date_of_birth: string | null
          discord_confirmed: boolean
          email: string
          evaluation_completed_at: string | null
          exam_date: string | null
          exam_notes: string | null
          exam_passed_at: string | null
          exam_provider: string | null
          exam_result: string | null
          first_name: string
          hired_at: string | null
          id: string
          instagram_handle: string | null
          invalid_referral_slug: string | null
          last_contacted_at: string | null
          last_follow_up_at: string | null
          last_name: string
          licensed: boolean
          licensing_at: string | null
          licensing_status: string | null
          next_follow_up_at: string | null
          npn: string | null
          onboarding_completed_at: string | null
          onboarding_steps: Json | null
          original_recruiter_id: string | null
          original_referral_name_snapshot: string | null
          original_referral_profile_id: string | null
          overview_completed_at: string | null
          overview_scheduled_at: string | null
          phone: string | null
          portal_invitation_id: string | null
          portal_profile_id: string | null
          pre_licensing_at: string | null
          priority: string
          promoted_by_user_id: string | null
          promoted_to_agent_at: string | null
          recruiting_status: string
          ref_slug: string | null
          referral_landing_url: string | null
          referral_source: string | null
          referred_by_name: string | null
          referred_by_name_snapshot: string | null
          referred_by_profile_id: string | null
          requested_overview_at: string | null
          resident_state: string | null
          scheduled_event_end: string | null
          scheduled_event_id: string | null
          scheduled_event_start: string | null
          scheduled_event_url: string | null
          scheduled_invitee_id: string | null
          scheduling_status: string
          source_details: string | null
          source_id: string | null
          stage_entered_at: string
          state: string | null
          status: string
          success_page_type: string | null
          team_id: string | null
          training_started_at: string | null
          updated_at: string
          wants_one_on_one: boolean
          why_text: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          assigned_manager_id?: string | null
          assigned_recruiter_id?: string | null
          calendly_scheduled_at?: string | null
          calendly_url_used?: string | null
          city?: string | null
          confirmation_token?: string | null
          consent_contact?: boolean
          course_confirmed_at?: string | null
          created_at?: string
          current_stage_id?: string | null
          date_of_birth?: string | null
          discord_confirmed?: boolean
          email: string
          evaluation_completed_at?: string | null
          exam_date?: string | null
          exam_notes?: string | null
          exam_passed_at?: string | null
          exam_provider?: string | null
          exam_result?: string | null
          first_name: string
          hired_at?: string | null
          id?: string
          instagram_handle?: string | null
          invalid_referral_slug?: string | null
          last_contacted_at?: string | null
          last_follow_up_at?: string | null
          last_name: string
          licensed?: boolean
          licensing_at?: string | null
          licensing_status?: string | null
          next_follow_up_at?: string | null
          npn?: string | null
          onboarding_completed_at?: string | null
          onboarding_steps?: Json | null
          original_recruiter_id?: string | null
          original_referral_name_snapshot?: string | null
          original_referral_profile_id?: string | null
          overview_completed_at?: string | null
          overview_scheduled_at?: string | null
          phone?: string | null
          portal_invitation_id?: string | null
          portal_profile_id?: string | null
          pre_licensing_at?: string | null
          priority?: string
          promoted_by_user_id?: string | null
          promoted_to_agent_at?: string | null
          recruiting_status?: string
          ref_slug?: string | null
          referral_landing_url?: string | null
          referral_source?: string | null
          referred_by_name?: string | null
          referred_by_name_snapshot?: string | null
          referred_by_profile_id?: string | null
          requested_overview_at?: string | null
          resident_state?: string | null
          scheduled_event_end?: string | null
          scheduled_event_id?: string | null
          scheduled_event_start?: string | null
          scheduled_event_url?: string | null
          scheduled_invitee_id?: string | null
          scheduling_status?: string
          source_details?: string | null
          source_id?: string | null
          stage_entered_at?: string
          state?: string | null
          status?: string
          success_page_type?: string | null
          team_id?: string | null
          training_started_at?: string | null
          updated_at?: string
          wants_one_on_one?: boolean
          why_text?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          assigned_manager_id?: string | null
          assigned_recruiter_id?: string | null
          calendly_scheduled_at?: string | null
          calendly_url_used?: string | null
          city?: string | null
          confirmation_token?: string | null
          consent_contact?: boolean
          course_confirmed_at?: string | null
          created_at?: string
          current_stage_id?: string | null
          date_of_birth?: string | null
          discord_confirmed?: boolean
          email?: string
          evaluation_completed_at?: string | null
          exam_date?: string | null
          exam_notes?: string | null
          exam_passed_at?: string | null
          exam_provider?: string | null
          exam_result?: string | null
          first_name?: string
          hired_at?: string | null
          id?: string
          instagram_handle?: string | null
          invalid_referral_slug?: string | null
          last_contacted_at?: string | null
          last_follow_up_at?: string | null
          last_name?: string
          licensed?: boolean
          licensing_at?: string | null
          licensing_status?: string | null
          next_follow_up_at?: string | null
          npn?: string | null
          onboarding_completed_at?: string | null
          onboarding_steps?: Json | null
          original_recruiter_id?: string | null
          original_referral_name_snapshot?: string | null
          original_referral_profile_id?: string | null
          overview_completed_at?: string | null
          overview_scheduled_at?: string | null
          phone?: string | null
          portal_invitation_id?: string | null
          portal_profile_id?: string | null
          pre_licensing_at?: string | null
          priority?: string
          promoted_by_user_id?: string | null
          promoted_to_agent_at?: string | null
          recruiting_status?: string
          ref_slug?: string | null
          referral_landing_url?: string | null
          referral_source?: string | null
          referred_by_name?: string | null
          referred_by_name_snapshot?: string | null
          referred_by_profile_id?: string | null
          requested_overview_at?: string | null
          resident_state?: string | null
          scheduled_event_end?: string | null
          scheduled_event_id?: string | null
          scheduled_event_start?: string | null
          scheduled_event_url?: string | null
          scheduled_invitee_id?: string | null
          scheduling_status?: string
          source_details?: string | null
          source_id?: string | null
          stage_entered_at?: string
          state?: string | null
          status?: string
          success_page_type?: string | null
          team_id?: string | null
          training_started_at?: string | null
          updated_at?: string
          wants_one_on_one?: boolean
          why_text?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicants_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_assigned_recruiter_id_fkey"
            columns: ["assigned_recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_original_recruiter_id_fkey"
            columns: ["original_recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_original_referral_profile_id_fkey"
            columns: ["original_referral_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_portal_invitation_id_fkey"
            columns: ["portal_invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_portal_profile_id_fkey"
            columns: ["portal_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_promoted_by_user_id_fkey"
            columns: ["promoted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_referred_by_profile_id_fkey"
            columns: ["referred_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "applicant_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_value: Json | null
          previous_value: Json | null
          target_applicant_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          previous_value?: Json | null
          target_applicant_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          previous_value?: Json | null
          target_applicant_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_applicant_id_fkey"
            columns: ["target_applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          blurb: string | null
          body: string | null
          duration: string | null
          file_path: string | null
          id: string
          is_published: boolean
          kind: string
          media_type: string | null
          module_id: string
          position: number
          quiz_pass_threshold: number
          resource_label: string | null
          resource_path: string | null
          resource_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          blurb?: string | null
          body?: string | null
          duration?: string | null
          file_path?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          media_type?: string | null
          module_id: string
          position?: number
          quiz_pass_threshold?: number
          resource_label?: string | null
          resource_path?: string | null
          resource_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          blurb?: string | null
          body?: string | null
          duration?: string | null
          file_path?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          media_type?: string | null
          module_id?: string
          position?: number
          quiz_pass_threshold?: number
          resource_label?: string | null
          resource_path?: string | null
          resource_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          id: string
          position: number
          title: string
        }
        Insert: {
          course_id: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          course_id?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instructor_name: string | null
          instructor_role: string | null
          is_required: boolean
          long_description: string | null
          outcomes: string[]
          slug: string | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instructor_name?: string | null
          instructor_role?: string | null
          is_required?: boolean
          long_description?: string | null
          outcomes?: string[]
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instructor_name?: string | null
          instructor_role?: string | null
          is_required?: boolean
          long_description?: string | null
          outcomes?: string[]
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_campaign_subscriptions: {
        Row: {
          campaign_slug: string
          created_at: string
          id: string
          subscribed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_slug: string
          created_at?: string
          id?: string
          subscribed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_slug?: string
          created_at?: string
          id?: string
          subscribed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience: string
          cadence: string
          content: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          last_sent_at: string | null
          name: string
          next_send_at: string | null
          optional: boolean
          schedule_label: string | null
          slug: string
          target_profile_id: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          audience?: string
          cadence?: string
          content?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          name: string
          next_send_at?: string | null
          optional?: boolean
          schedule_label?: string | null
          slug: string
          target_profile_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string
          cadence?: string
          content?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          name?: string
          next_send_at?: string | null
          optional?: boolean
          schedule_label?: string | null
          slug?: string
          target_profile_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          applicant_id: string | null
          automated: boolean
          campaign_slug: string | null
          category: string
          created_at: string
          cta_url: string | null
          delivered_at: string | null
          error: string | null
          html: string
          id: string
          meta: Json
          profile_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_key: string
          template_name: string | null
          to_email: string
          to_name: string | null
          updated_at: string
        }
        Insert: {
          applicant_id?: string | null
          automated?: boolean
          campaign_slug?: string | null
          category?: string
          created_at?: string
          cta_url?: string | null
          delivered_at?: string | null
          error?: string | null
          html: string
          id?: string
          meta?: Json
          profile_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_key: string
          template_name?: string | null
          to_email: string
          to_name?: string | null
          updated_at?: string
        }
        Update: {
          applicant_id?: string | null
          automated?: boolean
          campaign_slug?: string | null
          category?: string
          created_at?: string
          cta_url?: string | null
          delivered_at?: string | null
          error?: string | null
          html?: string
          id?: string
          meta?: Json
          profile_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_key?: string
          template_name?: string | null
          to_email?: string
          to_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_keys: {
        Row: {
          created_at: string
          send_key: string
        }
        Insert: {
          created_at?: string
          send_key: string
        }
        Update: {
          created_at?: string
          send_key?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_override: Json | null
          created_at: string
          enabled: boolean
          id: string
          subject_override: string | null
          template_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_override?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          subject_override?: string | null
          template_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_override?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          subject_override?: string | null
          template_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          final_score: number | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          final_score?: number | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          final_score?: number | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          answers: Json
          applicant_id: string | null
          created_at: string
          email: string
          id: string
          matched: boolean
          score: number | null
        }
        Insert: {
          answers?: Json
          applicant_id?: string | null
          created_at?: string
          email: string
          id?: string
          matched?: boolean
          score?: number | null
        }
        Update: {
          answers?: Json
          applicant_id?: string | null
          created_at?: string
          email?: string
          id?: string
          matched?: boolean
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_profile_id: string | null
          applicant_id: string | null
          can_invite_agents: boolean
          can_invite_leaders: boolean
          can_manage_resources: boolean
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          instagram_handle: string | null
          invited_by: string | null
          last_name: string | null
          licensed: boolean
          manager_id: string | null
          notes: string | null
          npn: string | null
          parent_user_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          state: string | null
          status: string
          team_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          applicant_id?: string | null
          can_invite_agents?: boolean
          can_invite_leaders?: boolean
          can_manage_resources?: boolean
          created_at?: string
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          instagram_handle?: string | null
          invited_by?: string | null
          last_name?: string | null
          licensed?: boolean
          manager_id?: string | null
          notes?: string | null
          npn?: string | null
          parent_user_id?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
          state?: string | null
          status?: string
          team_id?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          applicant_id?: string | null
          can_invite_agents?: boolean
          can_invite_leaders?: boolean
          can_manage_resources?: boolean
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          instagram_handle?: string | null
          invited_by?: string | null
          last_name?: string | null
          licensed?: boolean
          manager_id?: string | null
          notes?: string | null
          npn?: string | null
          parent_user_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          status?: string
          team_id?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_profile_id_fkey"
            columns: ["accepted_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          enrollment_id: string
          id: string
          lesson_id: string
          quiz_score: number | null
        }
        Insert: {
          completed_at?: string | null
          enrollment_id: string
          id?: string
          lesson_id: string
          quiz_score?: number | null
        }
        Update: {
          completed_at?: string | null
          enrollment_id?: string
          id?: string
          lesson_id?: string
          quiz_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      library_resource_tags: {
        Row: {
          resource_id: string
          tag_id: string
        }
        Insert: {
          resource_id: string
          tag_id: string
        }
        Update: {
          resource_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_resource_tags_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "library_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_resource_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "library_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      library_resources: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration: string | null
          featured: boolean
          file_path: string | null
          id: string
          is_new: boolean
          is_required: boolean
          media_type: string | null
          position: number
          section: string
          slug: string | null
          status: string
          thumbnail_url: string | null
          title: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          featured?: boolean
          file_path?: string | null
          id?: string
          is_new?: boolean
          is_required?: boolean
          media_type?: string | null
          position?: number
          section?: string
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          type: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration?: string | null
          featured?: boolean
          file_path?: string | null
          id?: string
          is_new?: boolean
          is_required?: boolean
          media_type?: string | null
          position?: number
          section?: string
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      library_tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      media_transcripts: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          notes: Json | null
          notes_error: string | null
          notes_status: string
          owner_id: string
          owner_type: string
          provider_job_id: string | null
          requested_at: string | null
          resolved_url: string | null
          source_url: string | null
          speaker_names: Json
          status: string
          transcript_segments: Json | null
          transcript_text: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          notes?: Json | null
          notes_error?: string | null
          notes_status?: string
          owner_id: string
          owner_type: string
          provider_job_id?: string | null
          requested_at?: string | null
          resolved_url?: string | null
          source_url?: string | null
          speaker_names?: Json
          status?: string
          transcript_segments?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          notes?: Json | null
          notes_error?: string | null
          notes_status?: string
          owner_id?: string
          owner_type?: string
          provider_job_id?: string | null
          requested_at?: string | null
          resolved_url?: string | null
          source_url?: string | null
          speaker_names?: Json
          status?: string
          transcript_segments?: Json | null
          transcript_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_archived: boolean
          is_completed_stage: boolean
          is_lost_stage: boolean
          name: string
          position: number
          slug: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_completed_stage?: boolean
          is_lost_stage?: boolean
          name: string
          position: number
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_completed_stage?: boolean
          is_lost_stage?: boolean
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      presenters: {
        Row: {
          created_at: string
          id: string
          initials: string
          is_active: boolean
          is_external: boolean
          name: string
          photo_url: string | null
          profile_id: string | null
          role: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          initials: string
          is_active?: boolean
          is_external?: boolean
          name: string
          photo_url?: string | null
          profile_id?: string | null
          role?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          initials?: string
          is_active?: boolean
          is_external?: boolean
          name?: string
          photo_url?: string | null
          profile_id?: string | null
          role?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presenters_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_invite_agents: boolean
          can_invite_leaders: boolean
          can_manage_resources: boolean
          can_receive_applicants: boolean
          can_schedule_licensed: boolean
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          hires: number
          id: string
          instagram_handle: string | null
          is_active: boolean
          last_name: string | null
          licensed: boolean
          licensed_calendly_updated_at: string | null
          licensed_calendly_url: string | null
          manager_id: string | null
          notification_prefs: Json | null
          npn: string | null
          one_on_one_calendly_updated_at: string | null
          one_on_one_calendly_url: string | null
          organization_path: string | null
          parent_user_id: string | null
          phone: string | null
          recruiting_slug: string | null
          resident_state: string | null
          state: string | null
          status: string
          team_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          can_invite_agents?: boolean
          can_invite_leaders?: boolean
          can_manage_resources?: boolean
          can_receive_applicants?: boolean
          can_schedule_licensed?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hires?: number
          id: string
          instagram_handle?: string | null
          is_active?: boolean
          last_name?: string | null
          licensed?: boolean
          licensed_calendly_updated_at?: string | null
          licensed_calendly_url?: string | null
          manager_id?: string | null
          notification_prefs?: Json | null
          npn?: string | null
          one_on_one_calendly_updated_at?: string | null
          one_on_one_calendly_url?: string | null
          organization_path?: string | null
          parent_user_id?: string | null
          phone?: string | null
          recruiting_slug?: string | null
          resident_state?: string | null
          state?: string | null
          status?: string
          team_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          can_invite_agents?: boolean
          can_invite_leaders?: boolean
          can_manage_resources?: boolean
          can_receive_applicants?: boolean
          can_schedule_licensed?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hires?: number
          id?: string
          instagram_handle?: string | null
          is_active?: boolean
          last_name?: string | null
          licensed?: boolean
          licensed_calendly_updated_at?: string | null
          licensed_calendly_url?: string | null
          manager_id?: string | null
          notification_prefs?: Json | null
          npn?: string | null
          one_on_one_calendly_updated_at?: string | null
          one_on_one_calendly_url?: string | null
          organization_path?: string | null
          parent_user_id?: string | null
          phone?: string | null
          recruiting_slug?: string | null
          resident_state?: string | null
          state?: string | null
          status?: string
          team_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_links: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          position: number
          sub: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          position?: number
          sub?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          sub?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          correct_index: number
          explanation: string | null
          id: string
          lesson_id: string
          options: string[]
          position: number
          question_text: string
        }
        Insert: {
          correct_index?: number
          explanation?: string | null
          id?: string
          lesson_id: string
          options?: string[]
          position?: number
          question_text: string
        }
        Update: {
          correct_index?: number
          explanation?: string | null
          id?: string
          lesson_id?: string
          options?: string[]
          position?: number
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          audio: boolean
          created_at: string
          description: string | null
          duration: string | null
          featured: boolean
          file_path: string | null
          format: string
          id: string
          is_new: boolean
          is_published: boolean
          position: number
          presenter_id: string
          presenter_role: string | null
          recorded_on: string | null
          slug: string | null
          status: string
          thumbnail_url: string | null
          title: string
          topic: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          audio?: boolean
          created_at?: string
          description?: string | null
          duration?: string | null
          featured?: boolean
          file_path?: string | null
          format?: string
          id?: string
          is_new?: boolean
          is_published?: boolean
          position?: number
          presenter_id: string
          presenter_role?: string | null
          recorded_on?: string | null
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          audio?: boolean
          created_at?: string
          description?: string | null
          duration?: string | null
          featured?: boolean
          file_path?: string | null
          format?: string
          id?: string
          is_new?: boolean
          is_published?: boolean
          position?: number
          presenter_id?: string
          presenter_role?: string | null
          recorded_on?: string | null
          slug?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_presenter_id_fkey"
            columns: ["presenter_id"]
            isOneToOne: false
            referencedRelation: "presenters"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          body: string | null
          category: string
          created_at: string
          created_by: string | null
          cta: string | null
          description: string | null
          display_date: string | null
          id: string
          is_published: boolean
          kind: string
          long: string | null
          meta: string | null
          position: number
          published_by: string | null
          tags: string[]
          title: string
          type: string
          updated_at: string
          updated_by: string | null
          url: string | null
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          description?: string | null
          display_date?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          long?: string | null
          meta?: string | null
          position?: number
          published_by?: string | null
          tags?: string[]
          title: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          description?: string | null
          display_date?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          long?: string | null
          meta?: string | null
          position?: number
          published_by?: string | null
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          applicant_id: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          notes: string | null
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          applicant_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      academy_can_manage: { Args: { _uid: string }; Returns: boolean }
      academy_slugify: { Args: { _txt: string }; Returns: string }
      can_access_user: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      can_invite_role: {
        Args: { _inviter: string; _role: string }
        Returns: boolean
      }
      cancel_invitation: { Args: { _id: string }; Returns: Json }
      company_leaderboard: {
        Args: { payload: Json }
        Returns: {
          avatar_url: string
          completed_count: number
          contacted_count: number
          conversion: number
          full_name: string
          hired_count: number
          manager_name: string
          new_count: number
          prev_total: number
          profile_id: string
          promoted_count: number
          role: string
          scheduled_count: number
          team_name: string
          total: number
        }[]
      }
      create_invitation: { Args: { payload: Json }; Returns: Json }
      default_onboarding_steps: { Args: never; Returns: Json }
      descendant_ids: {
        Args: { _root: string }
        Returns: {
          id: string
        }[]
      }
      email_claim_send: { Args: { _key: string }; Returns: boolean }
      enqueue_email: { Args: { payload: Json }; Returns: string }
      ensure_onboarding_invitation: {
        Args: { _applicant_id: string }
        Returns: Json
      }
      finalize_invitation_acceptance: { Args: { payload: Json }; Returns: Json }
      get_applicant_notify_context: { Args: { _token: string }; Returns: Json }
      get_evaluation_prefill: { Args: { _applicant_id: string }; Returns: Json }
      get_invitation_public: { Args: { _token: string }; Returns: Json }
      get_overview_prefill: { Args: { _token: string }; Returns: Json }
      get_primary_role: { Args: { _user_id: string }; Returns: string }
      get_recruiter_by_slug: {
        Args: { _slug: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          recruiting_slug: string
          team_name: string
        }[]
      }
      get_recruiter_for_applicant: {
        Args: { _applicant_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_descendant: {
        Args: { _ancestor: string; _target: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_applicant_scheduled: { Args: { _email: string }; Returns: Json }
      mark_licensed_fallback: { Args: { _token: string }; Returns: Json }
      mark_scheduled_by_token: { Args: { _token: string }; Returns: Json }
      promote_applicant_to_agent: { Args: { payload: Json }; Returns: Json }
      resend_invitation: { Args: { _id: string }; Returns: Json }
      resolve_one_on_one_url: { Args: { _profile_id: string }; Returns: string }
      resolve_scheduling_context: { Args: { _token: string }; Returns: Json }
      search_recruiters: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          recruiting_slug: string
          team_name: string
        }[]
      }
      set_requested_overview: {
        Args: { _at: string; _token: string }
        Returns: Json
      }
      slugify_name: { Args: { _text: string }; Returns: string }
      submit_application: { Args: { payload: Json }; Returns: Json }
      submit_evaluation: { Args: { payload: Json }; Returns: Json }
      update_onboarding: { Args: { _step: string }; Returns: Json }
    }
    Enums: {
      app_role: "agent" | "manager" | "admin" | "super_admin" | "leader"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["agent", "manager", "admin", "super_admin", "leader"],
    },
  },
} as const
