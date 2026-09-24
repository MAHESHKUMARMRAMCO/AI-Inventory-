import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { listInventory, addInventory as addInventoryApi } from '../../api/client';

export const fetchInventoryThunk = createAsyncThunk('inventory/fetchAll', async (_, { rejectWithValue }) => {
  const { status, body } = await listInventory();
  if (status >= 400) {
    return rejectWithValue(body ?? { error: `http_${status}` });
  }
  return body;
});

export const addInventoryThunk = createAsyncThunk('inventory/add', async (inventory, { dispatch, rejectWithValue }) => {
  const { status, body } = await addInventoryApi(inventory);
  if (status >= 400) {
    return rejectWithValue(body ?? { error: `http_${status}` });
  }
  dispatch(fetchInventoryThunk());
  return body;
});

const inventorySlice = createSlice({
  name: 'inventory',
  initialState: { items: [], listStatus: 'idle', addStatus: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventoryThunk.pending, (state) => {
        state.listStatus = 'loading';
      })
      .addCase(fetchInventoryThunk.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchInventoryThunk.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.error = action.payload ?? { error: 'request_failed' };
      })
      .addCase(addInventoryThunk.pending, (state) => {
        state.addStatus = 'loading';
        state.error = null;
      })
      .addCase(addInventoryThunk.fulfilled, (state) => {
        state.addStatus = 'succeeded';
      })
      .addCase(addInventoryThunk.rejected, (state, action) => {
        state.addStatus = 'failed';
        state.error = action.payload ?? { error: 'request_failed' };
      });
  }
});

export default inventorySlice.reducer;
