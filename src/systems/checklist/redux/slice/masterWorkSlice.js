import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchMasterWorksApi, updateMasterWorkApi, fetchMasterWorkShopsApi } from "../api/masterWorkApi";

export const fetchMasterWorks = createAsyncThunk("masterWork/fetch", async (_, { rejectWithValue }) => {
  try {
    const [items, shops] = await Promise.all([fetchMasterWorksApi(), fetchMasterWorkShopsApi()]);
    return { items, shops };
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const updateMasterWork = createAsyncThunk("masterWork/update", async (task, { rejectWithValue }) => {
  try {
    return await updateMasterWorkApi(task);
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

const masterWorkSlice = createSlice({
  name: "masterWork",
  initialState: { items: [], shops: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMasterWorks.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchMasterWorks.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload.items;
        s.shops = a.payload.shops;
      })
      .addCase(fetchMasterWorks.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload || a.error.message;
      })
      .addCase(updateMasterWork.fulfilled, (s, a) => {
        s.items = s.items.map((t) => (t.id === a.payload.id ? { ...t, ...a.payload, shop_name: a.payload.shop_name ?? t.shop_name } : t));
      });
  },
});

export default masterWorkSlice.reducer;
