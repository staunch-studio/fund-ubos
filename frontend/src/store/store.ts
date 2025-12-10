import { configureStore } from '@reduxjs/toolkit'
import { ubosApi } from './ubosApi'

export const store = configureStore({
  reducer: {
    [ubosApi.reducerPath]: ubosApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(ubosApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

