import { formatPaymentDays } from '../accounts-receivable.utils'

export function PaymentDaysCell({ days, isOpen }: { days: number; isOpen: boolean }) {
  return (
    <>
      <span className="text-content-secondary font-medium">{formatPaymentDays(days)}</span>
      {isOpen && <span className="block text-content-faint">en curso</span>}
    </>
  )
}
