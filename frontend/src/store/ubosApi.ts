import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  EntityInstance,
  EntitySnapshot,
  GetEntitiesParams,
  GetSnapshotParams,
  BatchCommitRequest,
  BatchCommitResponse,
} from '../types/ubos'

export const ubosApi = createApi({
  reducerPath: 'ubosApi',
  baseQuery: fetchBaseQuery({
    // Base URL: /api/console
    // Full URLs will be:
    // - /api/console/entities
    // - /api/console/snapshot
    // - /api/console/batch-commit
    // Vite proxy forwards /api/* to http://localhost:8080/api/*
    baseUrl: '/api/console',
    // No Authorization headers - backend uses IP whitelisting
  }),
  tagTypes: ['Entity', 'Snapshot'],
  endpoints: (builder) => ({
    // GET /entities
    getEntities: builder.query<EntityInstance[], GetEntitiesParams>({
      query: (params) => {
        const searchParams = new URLSearchParams()
        searchParams.append('branch', params.branch)
        if (params.type) {
          searchParams.append('type', params.type)
        }
        if (params.search) {
          searchParams.append('search', params.search)
        }
        return {
          url: 'entities',
          params: searchParams,
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Entity' as const, id })),
              { type: 'Entity', id: 'LIST' },
            ]
          : [{ type: 'Entity', id: 'LIST' }],
    }),

    // GET /snapshot
    getSnapshot: builder.query<EntitySnapshot, GetSnapshotParams>({
      query: (params) => ({
        url: 'snapshot',
        params: {
          slug: params.slug,
          type: params.entityType,
        },
      }),
      providesTags: (_result, _error, arg) => [
        { type: 'Snapshot', id: `${arg.slug}-${arg.entityType}` },
      ],
    }),

    // POST /batch-commit
    batchCommit: builder.mutation<BatchCommitResponse, BatchCommitRequest>({
      query: (body) => ({
        url: 'batch-commit',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, error) => {
        if (error) {
          return []
        }
        // Invalidate entity list to trigger refresh
        return [{ type: 'Entity', id: 'LIST' }]
      },
    }),
  }),
})

export const {
  useGetEntitiesQuery,
  useGetSnapshotQuery,
  useBatchCommitMutation,
} = ubosApi

