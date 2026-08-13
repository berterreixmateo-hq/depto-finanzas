/**
 * Tipos escritos a mano siguiendo el esquema de supabase/migrations/0001_init.sql.
 * Cuando tengas la Supabase CLI logueada, reemplazá este archivo generándolo con:
 *   supabase gen types typescript --project-id <id> > lib/types/database.types.ts
 */

export type SplitType = "50_50" | "custom" | "only_payer";
export type ExpenseSource = "manual" | "recurring" | "shopping";
export type RecurringStatus = "pending" | "paid";
export type ShoppingListType = "faltantes" | "super";

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["households"]["Insert"]>;
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          display_name: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["household_members"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          color: string;
          icon: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          color: string;
          icon: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: {
          id: string;
          household_id: string;
          category_id: string;
          effective_month: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          category_id: string;
          effective_month: string;
          amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          household_id: string;
          category_id: string;
          description: string;
          amount: number;
          expense_date: string;
          paid_by: string;
          payer_share_percentage: number;
          split_type: SplitType;
          source: ExpenseSource;
          recurring_instance_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          category_id: string;
          description: string;
          amount: number;
          expense_date: string;
          paid_by: string;
          payer_share_percentage?: number;
          split_type?: SplitType;
          source?: ExpenseSource;
          recurring_instance_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          household_id: string;
          amount: number;
          settled_by: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          amount: number;
          settled_by: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settlements"]["Insert"]>;
        Relationships: [];
      };
      recurring_expenses: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          category_id: string;
          estimated_amount: number;
          day_of_month: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          category_id: string;
          estimated_amount: number;
          day_of_month: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["recurring_expenses"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_expense_instances: {
        Row: {
          id: string;
          recurring_expense_id: string;
          household_id: string;
          month: string;
          due_date: string;
          estimated_amount: number;
          status: RecurringStatus;
          expense_id: string | null;
          invoice_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recurring_expense_id: string;
          household_id: string;
          month: string;
          due_date: string;
          estimated_amount: number;
          status?: RecurringStatus;
          expense_id?: string | null;
          invoice_url?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["recurring_expense_instances"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "recurring_expense_instances_recurring_expense_id_fkey";
            columns: ["recurring_expense_id"];
            isOneToOne: false;
            referencedRelation: "recurring_expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      shopping_items: {
        Row: {
          id: string;
          household_id: string;
          list_type: ShoppingListType;
          name: string;
          quantity: string | null;
          is_checked: boolean;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          list_type: ShoppingListType;
          name: string;
          quantity?: string | null;
          is_checked?: boolean;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["shopping_items"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Definidas en supabase/migrations/0002_onboarding_rpc.sql. Son el único
      // camino para crear un hogar o unirse a uno: la RLS ya no permite
      // insertar en `households` / `household_members` desde el cliente.
      create_household: {
        Args: { p_name: string; p_display_name: string };
        Returns: Database["public"]["Tables"]["households"]["Row"];
      };
      join_household: {
        Args: { p_invite_code: string; p_display_name: string };
        Returns: Database["public"]["Tables"]["households"]["Row"];
      };
    };
  };
}
