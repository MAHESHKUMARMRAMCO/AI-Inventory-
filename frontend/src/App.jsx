import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import OrderPage from './features/order/OrderPage';
import CustomerPage from './features/customer/CustomerPage';
import InventoryPage from './features/inventory/InventoryPage';

const navLinkClass = ({ isActive }) => `rounded px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`;

export default function App() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold">M08945 Order Fulfillment</h1>

      <nav className="flex gap-2 border-b border-gray-200 pb-3">
        <NavLink to="/orders" className={navLinkClass}>
          Order
        </NavLink>
        <NavLink to="/customers" className={navLinkClass}>
          Customer
        </NavLink>
        <NavLink to="/inventory" className={navLinkClass}>
          Inventory
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/orders" replace />} />
        <Route path="/orders" element={<OrderPage />} />
        <Route path="/customers" element={<CustomerPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
      </Routes>
    </div>
  );
}
