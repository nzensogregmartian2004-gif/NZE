import { apiRequest } from "./api";

export type PaymentStatus = "en_attente" | "reussi" | "echoue" | "incertain";
export type TransactionType = "PAYMENT" | "GIVE_CHANGE";
export type OrderPayment = {
  id: string;
  montant: string;
  type: "abonnement" | "publicite" | "autre" | "commande";
  statut: PaymentStatus;
  provider: string | null;
  merchantReference: string | null;
  providerReference: string | null;
  checkoutGroupId: string | null;
  operatorCode: string | null;
  providerStatus: string | null;
  transactionType?: TransactionType;
  beneficiaryAccountNumber?: string | null;
  majLe: string;
  confirmeLe: string | null;
  creeLe: string;
};
export type CheckoutPaymentSnapshot = {
  checkoutGroupId: string;
  orderTotal: string;
  currency: "XAF";
  orders: Array<{ id: string; storeId: string; total: string; statut: string }>;
  payment: OrderPayment | null;
};
export type DisbursementInput = {
  requestKey: string;
  recipientUserId: string;
  amount: number;
  customerAccountNumber: string;
  operatorCode: string;
  note?: string;
};
export type DisbursementResult = { message: string; payment: OrderPayment; reusedExistingAttempt?: boolean; providerMessage?: string };

export function initiateOrderPayment(token: string, checkoutGroupId: string, customerAccountNumber: string, operatorCode: string) {
  return apiRequest<{ message: string; payment: OrderPayment; reusedExistingAttempt?: boolean; providerMessage?: string }>(
    `/payments/orders/${checkoutGroupId}/initiate`, { method: "POST", token, body: { customerAccountNumber, operatorCode } },
  );
}
export function getCheckoutPayment(token: string, checkoutGroupId: string) {
  return apiRequest<CheckoutPaymentSnapshot>(`/payments/checkout/${checkoutGroupId}`, { token });
}
export function listMyPayments(token: string) {
  return apiRequest<OrderPayment[]>("/payments/me", { token });
}
export function createDisbursement(token: string, body: DisbursementInput) {
  return apiRequest<DisbursementResult>("/payments/admin/disbursements", { method: "POST", token, body });
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  en_attente: "En attente de confirmation MyPVit",
  reussi: "Transaction confirmée",
  echoue: "Transaction refusée",
  incertain: "Résultat incertain — vérification requise",
};
