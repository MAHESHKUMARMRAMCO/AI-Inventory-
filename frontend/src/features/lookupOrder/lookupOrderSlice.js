import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getOrder as getOrderApi } from '../../api/client';

export const lookupOrderThunk = createAsyncThunk('lookupOrder/lookup', async (orderid, { rejectWithValue }) => {
  const { status, body } = await getOrderApi(orderid);
  if (status >= 400) {
    return rejectWithValue(body ?? { error: `http_${status}` });
  }
  return body;
});

const lookupOrderSlice = createSlice({
  name: 'lookupOrder',
  initialState: { status: 'idle', result: null, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(lookupOrderThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(lookupOrderThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.result = action.payload;
      })
      .addCase(lookupOrderThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? { error: 'request_failed' };
      });
  }
});

export default lookupOrderSlice.reducer;
