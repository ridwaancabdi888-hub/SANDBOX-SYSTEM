export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          title: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          title: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          cost: number | null
          created_at: string
          current_quantity: number
          id: string
          minimum_quantity: number
          name: string
          supplier: string | null
          unit: Database["public"]["Enums"]["ingredient_unit"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost?: number | null
          created_at?: string
          current_quantity?: number
          id?: string
          minimum_quantity?: number
          name: string
          supplier?: string | null
          unit: Database["public"]["Enums"]["ingredient_unit"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number | null
          created_at?: string
          current_quantity?: number
          id?: string
          minimum_quantity?: number
          name?: string
          supplier?: string | null
          unit?: Database["public"]["Enums"]["ingredient_unit"]
          updated_at?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          after_quantity: number
          before_quantity: number
          created_at: string
          id: string
          ingredient_id: string
          order_id: string | null
          quantity: number
          reason: string | null
          type: Database["public"]["Enums"]["stock_txn_type"]
          user_id: string | null
        }
        Insert: {
          after_quantity: number
          before_quantity: number
          created_at?: string
          id?: string
          ingredient_id: string
          order_id?: string | null
          quantity: number
          reason?: string | null
          type: Database["public"]["Enums"]["stock_txn_type"]
          user_id?: string | null
        }
        Update: {
          after_quantity?: number
          before_quantity?: number
          created_at?: string
          id?: string
          ingredient_id?: string
          order_id?: string | null
          quantity?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["stock_txn_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          qr_token: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          qr_token?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          qr_token?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          read: boolean
          role: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          read?: boolean
          role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          read?: boolean
          role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token: string
          created_at: string
          created_by: string | null
          customer_note: string | null
          discount: number
          id: string
          location_id: string | null
          order_number: number
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          stock_deducted: boolean
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          created_by?: string | null
          customer_note?: string | null
          discount?: number
          id?: string
          location_id?: string | null
          order_number?: number
          source: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          stock_deducted?: boolean
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          created_by?: string | null
          customer_note?: string | null
          discount?: number
          id?: string
          location_id?: string | null
          order_number?: number
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          stock_deducted?: boolean
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          amount_paid: number
          cashier_id: string | null
          change_amount: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
        }
        Insert: {
          amount: number
          amount_paid: number
          cashier_id?: string | null
          change_amount?: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          cashier_id?: string | null
          change_amount?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_settings: {
        Row: {
          active: boolean
          auto_reconnect: boolean
          capabilities: Json
          config: Json
          connection_type: Database["public"]["Enums"]["printer_connection_type"]
          copies: number
          created_at: string
          encoding: string
          feed_lines: number
          id: string
          is_default: boolean
          name: string
          role: Database["public"]["Enums"]["printer_role"]
          width_mm: number
        }
        Insert: {
          active?: boolean
          auto_reconnect?: boolean
          capabilities?: Json
          config?: Json
          connection_type?: Database["public"]["Enums"]["printer_connection_type"]
          copies?: number
          created_at?: string
          encoding?: string
          feed_lines?: number
          id?: string
          is_default?: boolean
          name: string
          role?: Database["public"]["Enums"]["printer_role"]
          width_mm?: number
        }
        Update: {
          active?: boolean
          auto_reconnect?: boolean
          capabilities?: Json
          config?: Json
          connection_type?: Database["public"]["Enums"]["printer_connection_type"]
          copies?: number
          created_at?: string
          encoding?: string
          feed_lines?: number
          id?: string
          is_default?: boolean
          name?: string
          role?: Database["public"]["Enums"]["printer_role"]
          width_mm?: number
        }
        Relationships: []
      }
      product_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          product_id: string
          quantity: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          sku: string | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          sku?: string | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      settings: {
        Row: {
          address: string | null
          allow_negative_stock: boolean
          cafeteria_name: string
          currency: string
          id: number
          logo_url: string | null
          low_stock_threshold_default: number
          notification_settings: Json
          order_settings: Json
          phone: string | null
          receipt_footer: string | null
          receipt_header: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_negative_stock?: boolean
          cafeteria_name?: string
          currency?: string
          id?: number
          logo_url?: string | null
          low_stock_threshold_default?: number
          notification_settings?: Json
          order_settings?: Json
          phone?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_negative_stock?: boolean
          cafeteria_name?: string
          currency?: string
          id?: number
          logo_url?: string | null
          low_stock_threshold_default?: number
          notification_settings?: Json
          order_settings?: Json
          phone?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _create_order_internal: {
        Args: {
          p_created_by: string
          p_items: Json
          p_location_id: string
          p_note: string
          p_source: Database["public"]["Enums"]["order_source"]
        }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      adjust_stock: {
        Args: {
          p_ingredient_id: string
          p_quantity_delta: number
          p_reason: string
          p_type: Database["public"]["Enums"]["stock_txn_type"]
        }
        Returns: Database["public"]["Tables"]["ingredients"]["Row"]
      }
      advance_order_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_note?: string
          p_order_id: string
        }
        Returns: Database["public"]["Tables"]["orders"]["Row"]
      }
      create_staff_order: {
        Args: {
          p_items: Json
          p_location_id: string | null
          p_note: string
          p_source: Database["public"]["Enums"]["order_source"]
        }
        Returns: {
          access_token: string
          order_id: string
          order_number: number
        }[]
      }
      current_profile_active: { Args: Record<string, never>; Returns: boolean }
      current_profile_role: {
        Args: Record<string, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_order_tracking: { Args: { p_access_token: string }; Returns: Json }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_staff: { Args: Record<string, never>; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_description: string
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      notify_role: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_message: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_title: string
        }
        Returns: undefined
      }
      place_qr_order: {
        Args: { p_items: Json; p_location_code: string; p_note: string }
        Returns: {
          access_token: string
          order_id: string
          order_number: number
        }[]
      }
      record_payment: {
        Args: {
          p_amount_paid: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
        }
        Returns: {
          change_amount: number
          payment_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "cashier" | "kitchen" | "waiter"
      ingredient_unit: "kg" | "g" | "L" | "ml" | "pcs" | "box" | "pack"
      order_source: "QR_CUSTOMER" | "WAITER" | "CASHIER" | "ADMIN"
      order_status:
        | "NEW"
        | "PREPARING"
        | "READY"
        | "SERVED"
        | "COMPLETED"
        | "CANCELLED"
      payment_method: "CASH" | "ZAAD" | "EDAHAB" | "OTHER"
      printer_connection_type:
        | "BROWSER"
        | "BLUETOOTH_BLE"
        | "BLUETOOTH_CLASSIC"
        | "RAWBT"
        | "LAN"
        | "USB_BRIDGE"
        | "WINDOWS_SYSTEM"
        | "IOS_BRIDGE"
      printer_role: "RECEIPT" | "KITCHEN" | "BAR" | "BACKUP"
      stock_txn_type: "PURCHASE" | "SALE" | "ADJUSTMENT" | "WASTE" | "RETURN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cashier", "kitchen", "waiter"],
      ingredient_unit: ["kg", "g", "L", "ml", "pcs", "box", "pack"],
      order_source: ["QR_CUSTOMER", "WAITER", "CASHIER", "ADMIN"],
      order_status: [
        "NEW",
        "PREPARING",
        "READY",
        "SERVED",
        "COMPLETED",
        "CANCELLED",
      ],
      payment_method: ["CASH", "ZAAD", "EDAHAB", "OTHER"],
      printer_connection_type: [
        "BROWSER",
        "BLUETOOTH_BLE",
        "BLUETOOTH_CLASSIC",
        "RAWBT",
        "LAN",
        "USB_BRIDGE",
        "WINDOWS_SYSTEM",
        "IOS_BRIDGE",
      ],
      printer_role: ["RECEIPT", "KITCHEN", "BAR", "BACKUP"],
      stock_txn_type: ["PURCHASE", "SALE", "ADJUSTMENT", "WASTE", "RETURN"],
    },
  },
} as const
