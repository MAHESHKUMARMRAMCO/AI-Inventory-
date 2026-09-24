import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { submitOrderThunk } from './submitOrderSlice';
import FulfillmentResult from '../../components/FulfillmentResult';

const initialForm = {
  orderid: '',
  customerid: '',
  customertype: 'Standard',
  productid: '',
  quantity: '',
  promiseddeliverydate: ''
};

export default function SubmitOrderForm() {
  const dispatch = useDispatch();
  const { status, result, error } = useSelector((state) => state.submitOrder);
  const [form, setForm] = useState(initialForm);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    dispatch(
      submitOrderThunk({
        ...form,
        quantity: Number(form.quantity)
      })
    );
  }

  return (
    <div className="rounded border border-gray-300 p-4">
      <h2 className="mb-3 text-lg font-semibold">Submit Order</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2">
        <input name="orderid" placeholder="orderid" value={form.orderid} onChange={handleChange} required className="col-span-2 rounded border px-2 py-1" />
        <input name="customerid" placeholder="customerid" value={form.customerid} onChange={handleChange} required className="rounded border px-2 py-1" />
        <select name="customertype" value={form.customertype} onChange={handleChange} className="rounded border px-2 py-1">
          <option value="Standard">Standard</option>
          <option value="Priority">Priority</option>
        </select>
        <input name="productid" placeholder="productid" value={form.productid} onChange={handleChange} required className="rounded border px-2 py-1" />
        <input name="quantity" type="number" min="1" placeholder="quantity" value={form.quantity} onChange={handleChange} required className="rounded border px-2 py-1" />
        <input name="promiseddeliverydate" type="date" value={form.promiseddeliverydate} onChange={handleChange} required className="col-span-2 rounded border px-2 py-1" />
        <button type="submit" disabled={status === 'loading'} className="col-span-2 rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50">
          {status === 'loading' ? 'Submitting…' : 'Submit Order'}
        </button>
      </form>

      {status === 'succeeded' && <FulfillmentResult result={result} />}
      {status === 'failed' && (
        <div className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">
          {JSON.stringify(error)}
        </div>
      )}
    </div>
  );
}
