import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { submitOrder as submitOrderApi } from '../../api/client';

export const submitOrderThunk = createAsyncThunk('submitOrder/submit', async (order, { rejectWithValue }) => {
  const { status, body } = await submitOrderApi(order);
  if (status >= 400) {
    return rejectWithValue(body ?? { error: `http_${status}` });
  }
  return body;
});

const submitOrderSlice = createSlice({
  name: 'submitOrder',
  initialState: { status: 'idle', result: null, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(submitOrderThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(submitOrderThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.result = action.payload;
      })
      .addCase(submitOrderThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? { error: 'request_failed' };
      });
  }
});

export default submitOrderSlice.reducer;
