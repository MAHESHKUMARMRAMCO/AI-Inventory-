import SubmitOrderForm from '../submitOrder/SubmitOrderForm';
import LookupOrderView from '../lookupOrder/LookupOrderView';

export default function OrderPage() {
  return (
    <div className="space-y-6">
      <SubmitOrderForm />
      <LookupOrderView />
    </div>
  );
}
