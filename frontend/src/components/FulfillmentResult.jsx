export default function FulfillmentResult({ result }) {
  if (!result) return null;

  const isReleased = result.status === 'Released';

  return (
    <div className={`mt-4 rounded border p-3 text-sm ${isReleased ? 'border-green-400 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
      <div>
        <span className="font-semibold">orderid:</span> {result.orderid}
      </div>
      <div>
        <span className="font-semibold">status:</span> {result.status}
      </div>
      <div>
        <span className="font-semibold">reason:</span> {result.reason ?? 'null'}
      </div>
      <div>
        <span className="font-semibold">releasedquantity:</span> {result.releasedquantity}
      </div>
      <div>
        <span className="font-semibold">backorderedquantity:</span> {result.backorderedquantity}
      </div>
      <div>
        <span className="font-semibold">allocations:</span>{' '}
        {result.allocations && result.allocations.length > 0
          ? result.allocations.map((a) => `${a.warehouseid} x ${a.allocatedquantity}`).join(', ')
          : '[]'}
      </div>
      {result.backorder && (
        <div>
          <span className="font-semibold">backorder:</span> {result.backorder.quantity} ({result.backorder.status})
        </div>
      )}
    </div>
  );
}
