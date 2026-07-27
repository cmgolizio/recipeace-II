// Supabase database types for the `public` schema.
//
// Hand-authored to match supabase/migrations/*.sql and verified against the
// live schema by introspection. This mirrors the shape produced by
// `supabase gen types typescript`, so once you link the Supabase CLI (or a
// project) you can regenerate this file and it will be a drop-in replacement.

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
      favorite_recipes: {
        Row: {
          user_id: string;
          recipe_id: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          recipe_id: number;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          recipe_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorite_recipes_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_aliases: {
        Row: {
          id: number;
          alias: string;
          ingredient_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          alias: string;
          ingredient_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          alias?: string;
          ingredient_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_derivations: {
        Row: {
          id: number;
          source_id: number;
          derived_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          source_id: number;
          derived_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          source_id?: number;
          derived_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_derivations_derived_id_fkey";
            columns: ["derived_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredient_derivations_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_substitutions: {
        Row: {
          id: number;
          ingredient_id: number;
          substitute_id: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          ingredient_id: number;
          substitute_id: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          ingredient_id?: number;
          substitute_id?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_substitutions_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredient_substitutions_substitute_id_fkey";
            columns: ["substitute_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients: {
        Row: {
          id: number;
          name: string;
          category: Database["public"]["Enums"]["ingredient_category"];
          parent_id: number | null;
          is_staple: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          category: Database["public"]["Enums"]["ingredient_category"];
          parent_id?: number | null;
          is_staple?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          category?: Database["public"]["Enums"]["ingredient_category"];
          parent_id?: number | null;
          is_staple?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      pantry_items: {
        Row: {
          user_id: string;
          ingredient_id: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          ingredient_id: number;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          ingredient_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pantry_items_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          id: number;
          recipe_id: number;
          ingredient_id: number;
          amount: number | null;
          unit: string | null;
          preparation: string | null;
          is_optional: boolean;
          is_garnish: boolean;
          display_order: number;
          raw_text: string | null;
        };
        Insert: {
          id?: number;
          recipe_id: number;
          ingredient_id: number;
          amount?: number | null;
          unit?: string | null;
          preparation?: string | null;
          is_optional?: boolean;
          is_garnish?: boolean;
          display_order?: number;
          raw_text?: string | null;
        };
        Update: {
          id?: number;
          recipe_id?: number;
          ingredient_id?: number;
          amount?: number | null;
          unit?: string | null;
          preparation?: string | null;
          is_optional?: boolean;
          is_garnish?: boolean;
          display_order?: number;
          raw_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          id: number;
          slug: string;
          name: string;
          description: string | null;
          method: string | null;
          glass: string | null;
          garnish: string | null;
          image_url: string | null;
          instructions: string[];
          source: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
          strength: number | null;
          difficulty: Database["public"]["Enums"]["recipe_difficulty"] | null;
          flavor_tags: string[];
          base_spirit: string | null;
        };
        Insert: {
          id?: number;
          slug: string;
          name: string;
          description?: string | null;
          method?: string | null;
          glass?: string | null;
          garnish?: string | null;
          image_url?: string | null;
          instructions?: string[];
          source?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
          strength?: number | null;
          difficulty?: Database["public"]["Enums"]["recipe_difficulty"] | null;
          flavor_tags?: string[];
          base_spirit?: string | null;
        };
        Update: {
          id?: number;
          slug?: string;
          name?: string;
          description?: string | null;
          method?: string | null;
          glass?: string | null;
          garnish?: string | null;
          image_url?: string | null;
          instructions?: string[];
          source?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
          strength?: number | null;
          difficulty?: Database["public"]["Enums"]["recipe_difficulty"] | null;
          flavor_tags?: string[];
          base_spirit?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_recipes: {
        Args: {
          pantry: number[];
          max_missing?: number;
        };
        Returns: {
          recipe_id: number;
          required_count: number;
          exact_count: number;
          substitute_count: number;
          missing_count: number;
          missing_ingredients: string[];
        }[];
      };
      search_ingredients: {
        Args: {
          q: string;
          max_results?: number;
        };
        Returns: {
          id: number;
          name: string;
          category: Database["public"]["Enums"]["ingredient_category"];
          is_staple: boolean;
          matched_alias: string | null;
          score: number;
        }[];
      };
      match_recipes_detail: {
        Args: {
          pantry: number[];
          max_missing?: number;
        };
        Returns: {
          recipe_id: number;
          required_count: number;
          exact_count: number;
          substitute_count: number;
          missing_count: number;
          missing_ingredients: string[];
          slug: string;
          name: string;
          method: string | null;
          glass: string | null;
          ingredients: Json;
        }[];
      };
      popular_ingredients: {
        Args: {
          max_results?: number;
        };
        Returns: {
          id: number;
          name: string;
          recipe_count: number;
        }[];
      };
      recipe_pantry_status: {
        Args: {
          p_recipe_id: number;
          pantry: number[];
        };
        Returns: {
          ingredient_id: number;
          name: string;
          amount: number | null;
          unit: string | null;
          preparation: string | null;
          is_optional: boolean;
          is_garnish: boolean;
          display_order: number;
          status: string;
          substitute_with: string | null;
          derived_from: string | null;
        }[];
      };
    };
    Enums: {
      ingredient_category:
        | "spirit"
        | "liqueur"
        | "fortified_wine"
        | "wine"
        | "bitters"
        | "mixer"
        | "juice"
        | "syrup"
        | "dairy"
        | "produce"
        | "garnish"
        | "other"
        | "staple";
      recipe_difficulty: "easy" | "medium" | "advanced";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ── Convenience helpers (single `public` schema) ────────────────────────────
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];