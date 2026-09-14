import type { TranslationKey } from "./dictionary";
import type {
  AppRole,
  IngredientUnit,
  OrderSource,
  OrderStatus,
  PaymentMethod,
} from "@/lib/types/domain";

/**
 * Enum value → translation key.
 *
 * These exist so the **stored** value never changes. `role` stays `"cashier"`
 * in the database and in every query; only the label a human reads is
 * translated. Same for order status, payment method and unit — the DB enums
 * are the contract with `advance_order_status` and `record_payment`, and
 * translating them would break those functions.
 */
export const roleKey = (role: AppRole): TranslationKey =>
  `roles.${role}` as TranslationKey;

export const orderStatusKey = (status: OrderStatus): TranslationKey =>
  `orderStatus.${status}` as TranslationKey;

export const orderSourceKey = (source: OrderSource): TranslationKey =>
  `orderSource.${source}` as TranslationKey;

export const paymentMethodKey = (method: PaymentMethod): TranslationKey =>
  `paymentMethods.${method}` as TranslationKey;

export const unitKey = (unit: IngredientUnit): TranslationKey =>
  `units.${unit}` as TranslationKey;
