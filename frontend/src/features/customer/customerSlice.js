import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { listCustomers, addCustomer as addCustomerApi } from '../../api/client';

export const fetchCustomersThunk = createAsyncThunk('customer/fetchAll', async (_, { rejectWithValue }) => {
  const { status, body } = await listCustomers();
  if (status >= 400) {
    return rejectWithValue(body ?? { error: `http_${status}` });
  }
  return body;
});

export const addCustomerThunk = createAsyncThunk('customer/add', async (customer, { dispatch, rejectWithValue }) => {
  const { status, body } = await addCustomerApi(customer);
  if (status >= 400) {
    return rejectWithValue(body ?? { error: `http_${status}` });
  }
  dispatch(fetchCustomersThunk());
  return body;
});

const customerSlice = createSlice({
  name: 'customer',
  initialState: { items: [], listStatus: 'idle', addStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomersThunk.pending, (state) => {
        state.listStatus = 'loading';
      })
      .addCase(fetchCustomersThunk.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchCustomersThunk.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.error = action.payload ?? { error: 'request_failed' };
      })
      .addCase(addCustomerThunk.pending, (state) => {
        state.addStatus = 'loading';
        state.error = null;
      })
      .addCase(addCustomerThunk.fulfilled, (state) => {
        state.addStatus = 'succeeded';
      })
      .addCase(addCustomerThunk.rejected, (state, action) => {
        state.addStatus = 'failed';
        state.error = action.payload ?? { error: 'request_failed' };
      });
  }
});

export default customerSlice.reducer;
