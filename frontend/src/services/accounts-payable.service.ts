import { api } from "./api";
import type {
  ApiResponse,
  AccountsPayable,
  AccountsPayableDetail,
  AccountsPayableMeta,
  GetAccountsPayableParams,
  RegisterPayablePaymentPayload,
} from "@/types";

export async function getAccountsPayable(
  params?: GetAccountsPayableParams,
): Promise<{ items: AccountsPayable[]; meta: AccountsPayableMeta }> {
  const res = await api.get<ApiResponse<{ items: AccountsPayable[]; meta: AccountsPayableMeta }>>(
    "/accounts-payable",
    { params },
  );
  return res.data.data;
}

export async function getAccountPayable(id: string): Promise<AccountsPayableDetail> {
  const res = await api.get<ApiResponse<AccountsPayableDetail>>(`/accounts-payable/${id}`);
  return res.data.data;
}

export async function registerPayablePayment(
  id: string,
  payload: RegisterPayablePaymentPayload,
): Promise<AccountsPayableDetail> {
  const res = await api.post<ApiResponse<AccountsPayableDetail>>(
    `/accounts-payable/${id}/payments`,
    payload,
  );
  return res.data.data;
}
