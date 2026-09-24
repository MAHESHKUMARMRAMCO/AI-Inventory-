import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCustomersThunk, addCustomerThunk } from './customerSlice';

const initialForm = { customerid: '', eligibilitystatus: 'Eligible' };

export default function CustomerPage() {
  const dispatch = useDispatch();
  const { items, listStatus, addStatus, error } = useSelector((state) => state.customer);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    dispatch(fetchCustomersThunk());
  }, [dispatch]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    dispatch(addCustomerThunk(form)).then((action) => {
      if (action.meta.requestStatus === 'fulfilled') setForm(initialForm);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded border border-gray-300 p-4">
        <h2 className="mb-3 text-lg font-semibold">Add Customer</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2">
          <input
            name="customerid"
            placeholder="customerid"
            value={form.customerid}
            onChange={handleChange}
            required
            className="rounded border px-2 py-1"
          />
          <select name="eligibilitystatus" value={form.eligibilitystatus} onChange={handleChange} className="rounded border px-2 py-1">
            <option value="Eligible">Eligible</option>
            <option value="CreditHold">CreditHold</option>
            <option value="Unknown">Unknown</option>
          </select>
          <button
            type="submit"
            disabled={addStatus === 'loading'}
            className="col-span-2 rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50"
          >
            {addStatus === 'loading' ? 'Adding…' : 'Add Customer'}
          </button>
        </form>
        {addStatus === 'failed' && (
          <div className="mt-3 rounded border border-red-400 bg-red-50 p-2 text-sm text-red-700">{JSON.stringify(error)}</div>
        )}
      </div>

      <div className="rounded border border-gray-300 p-4">
        <h2 className="mb-3 text-lg font-semibold">Customers</h2>
        {listStatus === 'loading' && <p className="text-sm text-gray-500">Loading…</p>}
        {listStatus === 'succeeded' && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1">customerid</th>
                <th className="py-1">eligibilitystatus</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.customerid} className="border-b last:border-0">
                  <td className="py-1">{c.customerid}</td>
                  <td className="py-1">{c.eligibilitystatus}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-2 text-gray-500">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
