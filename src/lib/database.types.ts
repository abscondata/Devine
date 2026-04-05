export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      academic_terms: {
        Row: {
          id: string;
          program_id: string;
          title: string;
          starts_at: string | null;
          ends_at: string | null;
          is_current: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          title: string;
          starts_at?: string | null;
          ends_at?: string | null;
          is_current?: boolean;
          created_at?: string;
        };
        Update: {
          program_id?: string;
          title?: string;
          starts_at?: string | null;
          ends_at?: string | null;
          is_current?: boolean;
        };
        Relationships: [];
      };
      term_courses: {
        Row: {
          term_id: string;
          course_id: string;
        };
        Insert: {
          term_id: string;
          course_id: string;
        };
        Update: {
          term_id?: string;
          course_id?: string;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          title: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      program_members: {
        Row: {
          program_id: string;
          user_id: string;
          role: "owner" | "admin" | "staff" | "member";
          current_course_id: string | null;
          created_at: string;
        };
        Insert: {
          program_id: string;
          user_id: string;
          role?: "owner" | "admin" | "staff" | "member";
          current_course_id?: string | null;
          created_at?: string;
        };
        Update: {
          program_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "staff" | "member";
          current_course_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      review_links: {
        Row: {
          id: string;
          token_hash: string;
          program_id: string;
          created_at: string;
          expires_at: string | null;
          revoked_at: string | null;
          last_accessed_at: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          token_hash: string;
          program_id: string;
          created_at?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          last_accessed_at?: string | null;
          note?: string | null;
        };
        Update: {
          id?: string;
          token_hash?: string;
          program_id?: string;
          created_at?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          last_accessed_at?: string | null;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_links_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          }
        ];
      };
      thesis_projects: {
        Row: {
          id: string;
          program_id: string;
          course_id: string;
          created_by: string;
          title: string;
          research_question: string;
          governing_problem: string;
          thesis_claim: string | null;
          scope_statement: string;
          status: string;
          opened_at: string | null;
          candidacy_established_at: string | null;
          prospectus_locked_at: string | null;
          final_submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          course_id: string;
          created_by?: string;
          title: string;
          research_question: string;
          governing_problem: string;
          thesis_claim?: string | null;
          scope_statement: string;
          status?: string;
          opened_at?: string | null;
          candidacy_established_at?: string | null;
          prospectus_locked_at?: string | null;
          final_submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          course_id?: string;
          created_by?: string;
          title?: string;
          research_question?: string;
          governing_problem?: string;
          thesis_claim?: string | null;
          scope_statement?: string;
          status?: string;
          opened_at?: string | null;
          candidacy_established_at?: string | null;
          prospectus_locked_at?: string | null;
          final_submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thesis_projects_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thesis_projects_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          }
        ];
      };
      thesis_milestones: {
        Row: {
          id: string;
          thesis_project_id: string;
          created_by: string;
          milestone_key: string;
          title: string;
          position: number;
          required: boolean;
          completed_at: string | null;
          submission_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thesis_project_id: string;
          created_by?: string;
          milestone_key: string;
          title: string;
          position?: number;
          required?: boolean;
          completed_at?: string | null;
          submission_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          thesis_project_id?: string;
          created_by?: string;
          milestone_key?: string;
          title?: string;
          position?: number;
          required?: boolean;
          completed_at?: string | null;
          submission_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thesis_milestones_thesis_project_id_fkey";
            columns: ["thesis_project_id"];
            isOneToOne: false;
            referencedRelation: "thesis_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thesis_milestones_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          }
        ];
      };
        courses: {
          Row: {
            id: string;
            program_id: string;
            created_by: string;
            title: string;
            description: string | null;
            code: string | null;
            department_or_domain: string | null;
            credits_or_weight: number | null;
            level: string | null;
            sequence_position: number | null;
            learning_outcomes: string | null;
            syllabus: string | null;
            status: string;
            domain_id: string | null;
            is_active: boolean;
            created_at: string;
          };
          Insert: {
            id?: string;
            program_id: string;
            created_by?: string;
            title: string;
            description?: string | null;
            code?: string | null;
            department_or_domain?: string | null;
            credits_or_weight?: number | null;
            level?: string | null;
            sequence_position?: number | null;
            learning_outcomes?: string | null;
            syllabus?: string | null;
            status?: string;
            domain_id?: string | null;
            is_active?: boolean;
            created_at?: string;
          };
          Update: {
            id?: string;
            program_id?: string;
            created_by?: string;
            title?: string;
            description?: string | null;
            code?: string | null;
            department_or_domain?: string | null;
            credits_or_weight?: number | null;
            level?: string | null;
            sequence_position?: number | null;
            learning_outcomes?: string | null;
            syllabus?: string | null;
            status?: string;
            domain_id?: string | null;
            is_active?: boolean;
            created_at?: string;
          };
        Relationships: [{ foreignKeyName: "courses_program_id_fkey"; columns: ["program_id"]; isOneToOne: false; referencedRelation: "programs"; referencedColumns: ["id"] }, { foreignKeyName: "courses_domain_id_fkey"; columns: ["domain_id"]; isOneToOne: false; referencedRelation: "domains"; referencedColumns: ["id"] }];
      };
      domains: {
        Row: {
          id: string;
          created_by: string;
          code: string | null;
          title: string;
          description: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_by?: string;
          code?: string | null;
          title: string;
          description?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          created_by?: string;
          code?: string | null;
          title?: string;
          description?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      course_prerequisites: {
        Row: {
          course_id: string;
          prerequisite_course_id: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          course_id: string;
          prerequisite_course_id: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          course_id?: string;
          prerequisite_course_id?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "course_prerequisites_prerequisite_course_id_fkey"; columns: ["prerequisite_course_id"]; isOneToOne: false; referencedRelation: "courses"; referencedColumns: ["id"] }];
      };
      requirement_blocks: {
        Row: {
          id: string;
          program_id: string;
          title: string;
          description: string | null;
          category: string | null;
          minimum_courses_required: number | null;
          minimum_credits_required: number | null;
          position: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          title: string;
          description?: string | null;
          category?: string | null;
          minimum_courses_required?: number | null;
          minimum_credits_required?: number | null;
          position?: number;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          title?: string;
          description?: string | null;
          category?: string | null;
          minimum_courses_required?: number | null;
          minimum_credits_required?: number | null;
          position?: number;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "requirement_blocks_program_id_fkey"; columns: ["program_id"]; isOneToOne: false; referencedRelation: "programs"; referencedColumns: ["id"] }];
      };
      course_requirement_blocks: {
        Row: {
          course_id: string;
          requirement_block_id: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          course_id: string;
          requirement_block_id: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          course_id?: string;
          requirement_block_id?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "course_requirement_blocks_requirement_block_id_fkey"; columns: ["requirement_block_id"]; isOneToOne: false; referencedRelation: "requirement_blocks"; referencedColumns: ["id"] }];
      };
      modules: {
        Row: {
          id: string;
          course_id: string;
          created_by: string;
          title: string;
          overview: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          created_by?: string;
          title: string;
          overview?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          created_by?: string;
          title?: string;
          overview?: string | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "modules_course_id_fkey"; columns: ["course_id"]; isOneToOne: false; referencedRelation: "courses"; referencedColumns: ["id"] }];
      };
      assignments: {
        Row: {
          id: string;
          module_id: string;
          created_by: string;
          title: string;
          instructions: string;
          assignment_type: string;
          due_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          created_by?: string;
          title: string;
          instructions: string;
          assignment_type?: string;
          due_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          created_by?: string;
          title?: string;
          instructions?: string;
          assignment_type?: string;
          due_at?: string | null;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "assignments_module_id_fkey"; columns: ["module_id"]; isOneToOne: false; referencedRelation: "modules"; referencedColumns: ["id"] }];
      };
      readings: {
        Row: {
          id: string;
          module_id: string;
          created_by: string;
          title: string;
          author: string | null;
          source_type: string | null;
          primary_or_secondary: string | null;
          tradition_or_era: string | null;
          pages_or_length: string | null;
          estimated_hours: number | null;
          reference_url_or_citation: string | null;
          status: string;
          notes: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          created_by?: string;
          title: string;
          author?: string | null;
          source_type?: string | null;
          primary_or_secondary?: string | null;
          tradition_or_era?: string | null;
          pages_or_length?: string | null;
          estimated_hours?: number | null;
          reference_url_or_citation?: string | null;
          status?: string;
          notes?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          created_by?: string;
          title?: string;
          author?: string | null;
          source_type?: string | null;
          primary_or_secondary?: string | null;
          tradition_or_era?: string | null;
          pages_or_length?: string | null;
          estimated_hours?: number | null;
          reference_url_or_citation?: string | null;
          status?: string;
          notes?: string | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          assignment_id: string;
          user_id: string;
          content: string;
          version: number;
          is_final: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          user_id: string;
          content: string;
          version?: number;
          is_final?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          user_id?: string;
          content?: string;
          version?: number;
          is_final?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      critiques: {
        Row: {
          id: string;
          submission_id: string;
          submission_version: number;
          model: string | null;
          prompt_version: string | null;
          overall_verdict: string | null;
          thesis_strength: string | null;
          structural_failures: string[];
          unsupported_claims: string[];
          vague_terms: string[];
          strongest_objection: string | null;
          doctrinal_or_historical_imprecision: string[];
          rewrite_priorities: string[];
          score: number | null;
          critique_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          submission_version?: number;
          model?: string | null;
          prompt_version?: string | null;
          overall_verdict?: string | null;
          thesis_strength?: string | null;
          structural_failures?: string[];
          unsupported_claims?: string[];
          vague_terms?: string[];
          strongest_objection?: string | null;
          doctrinal_or_historical_imprecision?: string[];
          rewrite_priorities?: string[];
          score?: number | null;
          critique_json: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          submission_version?: number;
          model?: string | null;
          prompt_version?: string | null;
          overall_verdict?: string | null;
          thesis_strength?: string | null;
          structural_failures?: string[];
          unsupported_claims?: string[];
          vague_terms?: string[];
          strongest_objection?: string | null;
          doctrinal_or_historical_imprecision?: string[];
          rewrite_priorities?: string[];
          score?: number | null;
          critique_json?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      concepts: {
        Row: {
          id: string;
          title: string;
          type: string;
          description: string | null;
          related_course_id: string | null;
          related_module_id: string | null;
          status: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          type?: string;
          description?: string | null;
          related_course_id?: string | null;
          related_module_id?: string | null;
          status?: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          type?: string;
          description?: string | null;
          related_course_id?: string | null;
          related_module_id?: string | null;
          status?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      // ── Legacy operations tables (unused by Devine) ──
      profiles: {
        Row: { id: string; email: string; role: "owner" | "va" };
        Insert: { id: string; email: string; role?: "owner" | "va" };
        Update: { id?: string; email?: string; role?: "owner" | "va" };
        Relationships: [];
      };
      clients: {
        Row: {
          id: number; created_at: string; name: string; niche: string | null;
          status: string | null; primary_contact_name: string | null;
          primary_contact_email: string | null; primary_contact_phone: string | null;
          notes: string | null; employee_count: number | null;
          backoffice_tasks: string | null; pain_point: string | null;
          timezone: string | null; service_area: string | null;
          business_hours: string | null; escalation_email: string | null;
        };
        Insert: {
          id?: number; created_at?: string; name: string; niche?: string | null;
          status?: string | null; primary_contact_name?: string | null;
          primary_contact_email?: string | null; primary_contact_phone?: string | null;
          notes?: string | null; employee_count?: number | null;
          backoffice_tasks?: string | null; pain_point?: string | null;
          timezone?: string | null; service_area?: string | null;
          business_hours?: string | null; escalation_email?: string | null;
        };
        Update: {
          id?: number; created_at?: string; name?: string; niche?: string | null;
          status?: string | null; primary_contact_name?: string | null;
          primary_contact_email?: string | null; primary_contact_phone?: string | null;
          notes?: string | null; employee_count?: number | null;
          backoffice_tasks?: string | null; pain_point?: string | null;
          timezone?: string | null; service_area?: string | null;
          business_hours?: string | null; escalation_email?: string | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: number; created_at: string; client_id: number | null; title: string;
          task_type: string | null;
          status: Database["public"]["Enums"]["task_status"] | null;
          priority: string | null; due_at: string | null;
          sop_link: string | null; client_system_link: string | null;
          notes: string | null; escalation_required: boolean | null;
          assigned_va: string | null; ai_draft: string | null;
          workflow_type: string | null; source_system: string | null;
          source_record_id: string | null; edited_draft: string | null;
          final_message: string | null; recipient_email: string | null;
          recipient_name: string | null; subject_line: string | null;
          approved_at: string | null; sent_at: string | null;
          failed_at: string | null; rejection_reason: string | null;
          exception_reason_code: string | null; exception_description: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number; created_at?: string; client_id?: number | null; title: string;
          task_type?: string | null;
          status?: Database["public"]["Enums"]["task_status"] | null;
          priority?: string | null; due_at?: string | null;
          sop_link?: string | null; client_system_link?: string | null;
          notes?: string | null; escalation_required?: boolean | null;
          assigned_va?: string | null; ai_draft?: string | null;
          workflow_type?: string | null; source_system?: string | null;
          source_record_id?: string | null; edited_draft?: string | null;
          final_message?: string | null; recipient_email?: string | null;
          recipient_name?: string | null; subject_line?: string | null;
          approved_at?: string | null; sent_at?: string | null;
          failed_at?: string | null; rejection_reason?: string | null;
          exception_reason_code?: string | null; exception_description?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number; created_at?: string; client_id?: number | null; title?: string;
          task_type?: string | null;
          status?: Database["public"]["Enums"]["task_status"] | null;
          priority?: string | null; due_at?: string | null;
          sop_link?: string | null; client_system_link?: string | null;
          notes?: string | null; escalation_required?: boolean | null;
          assigned_va?: string | null; ai_draft?: string | null;
          workflow_type?: string | null; source_system?: string | null;
          source_record_id?: string | null; edited_draft?: string | null;
          final_message?: string | null; recipient_email?: string | null;
          recipient_name?: string | null; subject_line?: string | null;
          approved_at?: string | null; sent_at?: string | null;
          failed_at?: string | null; rejection_reason?: string | null;
          exception_reason_code?: string | null; exception_description?: string | null;
          updated_at?: string | null;
        };
        Relationships: [{ foreignKeyName: "tasks_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }];
      };
      exceptions: {
        Row: {
          id: number; created_at: string; client_id: number | null; task_id: number | null;
          issue_type: string | null; severity: string | null;
          description: string | null; resolution_status: string | null;
          resolved_by: string | null; resolved_at: string | null;
        };
        Insert: {
          id?: number; created_at?: string; client_id?: number | null; task_id?: number | null;
          issue_type?: string | null; severity?: string | null;
          description?: string | null; resolution_status?: string | null;
          resolved_by?: string | null; resolved_at?: string | null;
        };
        Update: {
          id?: number; created_at?: string; client_id?: number | null; task_id?: number | null;
          issue_type?: string | null; severity?: string | null;
          description?: string | null; resolution_status?: string | null;
          resolved_by?: string | null; resolved_at?: string | null;
        };
        Relationships: [];
      };
      client_configs: {
        Row: {
          id: string; client_id: number | null; workflow_type: string;
          is_enabled: boolean | null; send_window_start: string | null;
          send_window_end: string | null; send_days: string[] | null;
          tone_profile: string | null; exclusion_rules_json: Json | null;
          trigger_rules_json: Json | null; cooldown_rules_json: Json | null;
          escalation_rules_json: Json | null; created_at: string;
        };
        Insert: {
          id?: string; client_id?: number | null; workflow_type: string;
          is_enabled?: boolean | null; send_window_start?: string | null;
          send_window_end?: string | null; send_days?: string[] | null;
          tone_profile?: string | null; exclusion_rules_json?: Json | null;
          trigger_rules_json?: Json | null; cooldown_rules_json?: Json | null;
          escalation_rules_json?: Json | null; created_at?: string;
        };
        Update: {
          id?: string; client_id?: number | null; workflow_type?: string;
          is_enabled?: boolean | null; send_window_start?: string | null;
          send_window_end?: string | null; send_days?: string[] | null;
          tone_profile?: string | null; exclusion_rules_json?: Json | null;
          trigger_rules_json?: Json | null; cooldown_rules_json?: Json | null;
          escalation_rules_json?: Json | null; created_at?: string;
        };
        Relationships: [{ foreignKeyName: "client_configs_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }];
      };
      task_source_data: {
        Row: { id: string; task_id: number | null; payload_json: Json | null; normalized_fields_json: Json | null; created_at: string };
        Insert: { id?: string; task_id?: number | null; payload_json?: Json | null; normalized_fields_json?: Json | null; created_at?: string };
        Update: { id?: string; task_id?: number | null; payload_json?: Json | null; normalized_fields_json?: Json | null; created_at?: string };
        Relationships: [{ foreignKeyName: "task_source_data_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }];
      };
      task_events: {
        Row: { id: string; task_id: number | null; event_type: string; actor_type: string | null; actor_id: string | null; notes: string | null; created_at: string };
        Insert: { id?: string; task_id?: number | null; event_type: string; actor_type?: string | null; actor_id?: string | null; notes?: string | null; created_at?: string };
        Update: { id?: string; task_id?: number | null; event_type?: string; actor_type?: string | null; actor_id?: string | null; notes?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "task_events_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }];
      };
      send_logs: {
        Row: {
          id: string; task_id: number | null; channel: string | null;
          sender: string | null; recipient: string | null; subject_line: string | null;
          body_snapshot: string | null; delivery_status: string | null;
          external_message_id: string | null; sent_at: string | null;
          error_text: string | null; created_at: string;
        };
        Insert: {
          id?: string; task_id?: number | null; channel?: string | null;
          sender?: string | null; recipient?: string | null; subject_line?: string | null;
          body_snapshot?: string | null; delivery_status?: string | null;
          external_message_id?: string | null; sent_at?: string | null;
          error_text?: string | null; created_at?: string;
        };
        Update: {
          id?: string; task_id?: number | null; channel?: string | null;
          sender?: string | null; recipient?: string | null; subject_line?: string | null;
          body_snapshot?: string | null; delivery_status?: string | null;
          external_message_id?: string | null; sent_at?: string | null;
          error_text?: string | null; created_at?: string;
        };
        Relationships: [{ foreignKeyName: "send_logs_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }];
      };
      files: {
        Row: { id: number; created_at: string; client_id: number | null; file_name: string | null; file_url: string | null; file_type: string | null; notes: string | null };
        Insert: { id?: number; created_at?: string; client_id?: number | null; file_name?: string | null; file_url?: string | null; file_type?: string | null; notes?: string | null };
        Update: { id?: number; created_at?: string; client_id?: number | null; file_name?: string | null; file_url?: string | null; file_type?: string | null; notes?: string | null };
        Relationships: [];
      };
      sops: {
        Row: { id: number; created_at: string; client_id: number | null; title: string; trigger: string | null; steps: string | null; escalation_rule: string | null; active: boolean | null };
        Insert: { id?: number; created_at?: string; client_id?: number | null; title: string; trigger?: string | null; steps?: string | null; escalation_rule?: string | null; active?: boolean | null };
        Update: { id?: number; created_at?: string; client_id?: number | null; title?: string; trigger?: string | null; steps?: string | null; escalation_rule?: string | null; active?: boolean | null };
        Relationships: [];
      };
      task_logs: {
        Row: { id: number; created_at: string; task_id: number | null; log_type: string | null; message: string | null; created_by: string | null };
        Insert: { id?: number; created_at?: string; task_id?: number | null; log_type?: string | null; message?: string | null; created_by?: string | null };
        Update: { id?: number; created_at?: string; task_id?: number | null; log_type?: string | null; message?: string | null; created_by?: string | null };
        Relationships: [];
      };
      weekly_reports: {
        Row: { id: number; created_at: string; client_id: number | null; week_start: string | null; summary: string | null; open_issues: string | null };
        Insert: { id?: number; created_at?: string; client_id?: number | null; week_start?: string | null; summary?: string | null; open_issues?: string | null };
        Update: { id?: number; created_at?: string; client_id?: number | null; week_start?: string | null; summary?: string | null; open_issues?: string | null };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      create_course_with_blocks: {
        Args: {
          p_program_id: string;
          p_title: string;
          p_description: string | null;
          p_code: string | null;
          p_department_or_domain: string | null;
          p_credits_or_weight: number | null;
          p_level: string | null;
          p_sequence_position: number | null;
          p_learning_outcomes: string | null;
          p_syllabus: string | null;
          p_status: string | null;
          p_domain_id: string | null;
          p_is_active: boolean;
          p_requirement_block_ids: string[];
        };
        Returns: string;
      };
      update_course_with_blocks: {
        Args: {
          p_course_id: string;
          p_title: string;
          p_description: string | null;
          p_code: string | null;
          p_department_or_domain: string | null;
          p_credits_or_weight: number | null;
          p_level: string | null;
          p_sequence_position: number | null;
          p_learning_outcomes: string | null;
          p_syllabus: string | null;
          p_status: string | null;
          p_domain_id: string | null;
          p_is_active: boolean;
          p_requirement_block_ids: string[];
        };
        Returns: void;
      };
      create_thesis_project_with_milestones: {
        Args: {
          p_program_id: string;
          p_course_id: string;
          p_title: string;
          p_research_question: string;
          p_governing_problem: string;
          p_thesis_claim: string | null;
          p_scope_statement: string;
        };
        Returns: string;
      };
    };
    Enums: {
      task_status: "NEW" | "WAITING_ON_MISSING_DATA" | "READY_FOR_REVIEW" | "EXCEPTION" | "APPROVED" | "SENT" | "FAILED" | "CLOSED";
    };
    CompositeTypes: {};
  };
}
