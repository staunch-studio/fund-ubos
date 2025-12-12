import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

interface TenantState {
  tenantId: string | null
}

const initialState: TenantState = {
  tenantId: 'Tenant_A', // Default to first mock tenant
}

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setTenantId: (state, action: PayloadAction<string>) => {
      state.tenantId = action.payload
    },
  },
})

export const { setTenantId } = tenantSlice.actions
export default tenantSlice.reducer

