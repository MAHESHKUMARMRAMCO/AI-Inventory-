import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { lookupOrderThunk } from './lookupOrderSlice';
import FulfillmentResult from '../../components/FulfillmentResult';

export default function LookupOrderView() {
  const dispatch = useDispatch();
  const { status, result, error } = useSelector((state) => state.lookupOrder);
  const [orderid, setOrderid] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    dispatch(lookupOrderThunk(orderid));
  }

  return (
    <div className="rounded border border-gray-300 p-4">
      <h2 className="mb-3 text-lg font-semibold">Lookup Order</h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          placeholder="orderid"
          value={orderid}
          onChange={(e) => setOrderid(e.target.value)}
          required
          className="flex-1 rounded border px-2 py-1"
        />
        <button type="submit" disabled={status === 'loading'} className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50">
          {status === 'loading' ? 'Looking up…' : 'Lookup'}
        </button>
      </form>

      {status === 'succeeded' && <FulfillmentResult result={result} />}
      {status === 'failed' && (
        <div className="mt-4 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">
          {error?.error === 'order not found' ? `Order "${error.orderid}" not found.` : JSON.stringify(error)}
        </div>
      )}
    </div>
  );
}
