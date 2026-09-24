import { configureStore } from '@reduxjs/toolkit';
import submitOrderReducer from '../features/submitOrder/submitOrderSlice';
import lookupOrderReducer from '../features/lookupOrder/lookupOrderSlice';
import customerReducer from '../features/customer/customerSlice';
import inventoryReducer from '../features/inventory/inventorySlice';

export const store = configureStore({
  reducer: {
    submitOrder: submitOrderReducer,
    lookupOrder: lookupOrderReducer,
    customer: customerReducer,
    inventory: inventoryReducer
  }
});
