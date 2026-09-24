import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchInventoryThunk, addInventoryThunk } from './inventorySlice';

const initialForm = { productid: '', warehouseid: 'WH-A', availablequantity: '', earliestdispatchdate: '' };

export default function InventoryPage() {
  const dispatch = useDispatch();
  const { items, listStatus, addStatus, error } = useSelector((state) => state.inventory);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    dispatch(fetchInventoryThunk());
  }, [dispatch]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    dispatch(addInventoryThunk({ ...form, availablequantity: Number(form.availablequantity) })).then((action) => {
      if (action.meta.requestStatus === 'fulfilled') setForm(initialForm);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded border border-gray-300 p-4">
        <h2 className="mb-3 text-lg font-semibold">Add Inventory</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2">
          <input
            name="productid"
            placeholder="productid"
            value={form.productid}
            onChange={handleChange}
            required
            className="rounded border px-2 py-1"
          />
          <select name="warehouseid" value={form.warehouseid} onChange={handleChange} className="rounded border px-2 py-1">
            <option value="WH-A">WH-A</option>
            <option value="WH-B">WH-B</option>
            <option value="WH-C">WH-C</option>
          </select>
          <input
            name="availablequantity"
            type="number"
            min="1"
            placeholder="availablequantity"
            value={form.availablequantity}
            onChange={handleChange}
            required
            className="rounded border px-2 py-1"
          />
          <input
            name="earliestdispatchdate"
            type="date"
            value={form.earliestdispatchdate}
            onChange={handleChange}
            required
            className="rounded border px-2 py-1"
          />
          <button
            type="submit"
            disabled={addStatus === 'loading'}
            className="col-span-2 rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50"
          >
            {addStatus === 'loading' ? 'Adding…' : 'Add Inventory'}
          </button>
        </form>
        {addStatus === 'failed' && (
          <div className="mt-3 rounded border border-red-400 bg-red-50 p-2 text-sm text-red-700">{JSON.stringify(error)}</div>
        )}
      </div>

      <div className="rounded border border-gray-300 p-4">
        <h2 className="mb-3 text-lg font-semibold">Inventory</h2>
        {listStatus === 'loading' && <p className="text-sm text-gray-500">Loading…</p>}
        {listStatus === 'succeeded' && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1">productid</th>
                <th className="py-1">warehouseid</th>
                <th className="py-1">availablequantity</th>
                <th className="py-1">earliestdispatchdate</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={`${row.productid}-${row.warehouseid}`} className="border-b last:border-0">
                  <td className="py-1">{row.productid}</td>
                  <td className="py-1">{row.warehouseid}</td>
                  <td className="py-1">{row.availablequantity}</td>
                  <td className="py-1">{row.earliestdispatchdate}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-gray-500">
                    No inventory yet.
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
