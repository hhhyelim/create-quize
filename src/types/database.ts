export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          id: string;
          teacher_id: string;
          title: string;
          material_type: "text" | "image" | "txt";
          material_text: string | null;
          material_url: string | null;
          material_summary: string | null;
          material_keywords: Json | null;
          ai_material_analysis: Json | null;
          time_limit_sec: number;
          enabled_modes: Json;
          invite_code: string;
          status: "draft" | "active" | "closed";
          solve_mode_open: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          title: string;
          material_type: "text" | "image" | "txt";
          material_text?: string | null;
          material_url?: string | null;
          material_summary?: string | null;
          material_keywords?: Json | null;
          ai_material_analysis?: Json | null;
          time_limit_sec: number;
          enabled_modes: Json;
          invite_code: string;
          status?: "draft" | "active" | "closed";
          solve_mode_open?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          title?: string;
          material_type?: "text" | "image" | "txt";
          material_text?: string | null;
          material_url?: string | null;
          material_summary?: string | null;
          material_keywords?: Json | null;
          ai_material_analysis?: Json | null;
          time_limit_sec?: number;
          enabled_modes?: Json;
          invite_code?: string;
          status?: "draft" | "active" | "closed";
          solve_mode_open?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          activity_id: string;
          display_name: string;
          rejected_count: number;
          warning_shown: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          display_name: string;
          rejected_count?: number;
          warning_shown?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          activity_id?: string;
          display_name?: string;
          rejected_count?: number;
          warning_shown?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          id: string;
          activity_id: string;
          student_id: string;
          question_text: string;
          status: "accepted" | "hidden";
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          student_id: string;
          question_text: string;
          status?: "accepted" | "hidden";
          created_at?: string;
        };
        Update: {
          id?: string;
          activity_id?: string;
          student_id?: string;
          question_text?: string;
          status?: "accepted" | "hidden";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      question_attempts: {
        Row: {
          id: string;
          activity_id: string;
          student_id: string;
          attempted_text: string;
          result: "accepted" | "rejected";
          reject_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          student_id: string;
          attempted_text: string;
          result: "accepted" | "rejected";
          reject_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          activity_id?: string;
          student_id?: string;
          attempted_text?: string;
          result?: "accepted" | "rejected";
          reject_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_attempts_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      answers: {
        Row: {
          id: string;
          question_id: string;
          student_id: string;
          answer_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          student_id: string;
          answer_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          student_id?: string;
          answer_text?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      coaching_logs: {
        Row: {
          id: string;
          activity_id: string;
          student_id: string;
          student_text: string;
          ai_hint: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          student_id: string;
          student_text: string;
          ai_hint: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          activity_id?: string;
          student_id?: string;
          student_text?: string;
          ai_hint?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coaching_logs_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coaching_logs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
