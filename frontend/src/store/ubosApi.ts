import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  EntityInstance,
  EntitySnapshot,
  GetEntitiesParams,
  ResourceContextRequest,
  BatchCommitRequest,
  BatchCommitResponse,
  HistoryRecord,
  GetSnapshotByCommitParams,
  Branch,
  CreateBranchRequest,
  CreateBranchResponse,
  RevertRequest,
  RevertResponse,
  MergeRequest,
  MergeResponse,
  SearchRequest,
  SearchResult,
  ProcessRecord,
  ProcessDetail,
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
  tagTypes: ['Entity', 'Snapshot', 'History', 'Branch', 'Search', 'Process'],
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
    // Uses ResourceContextRequest DTO (slug, type, branch)
    // No transformResponse needed - backend returns Camel Case JSON directly
    getSnapshot: builder.query<EntitySnapshot, ResourceContextRequest>({
      query: (params) => ({
        url: 'snapshot',
        params: {
          slug: params.slug,
          type: params.type,
          branch: params.branch,
        },
      }),
      // ✅ No transformResponse - relies on default JSON parsing which respects backend's Camel Case
      providesTags: (_result, _error, arg) => [
        { type: 'Snapshot', id: `${arg.slug}-${arg.type}` },
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

    // GET /history
    // Uses ResourceContextRequest DTO (slug, type, branch)
    // No transformResponse needed - backend returns Camel Case JSON directly
    getHistory: builder.query<HistoryRecord[], ResourceContextRequest>({
      query: (params) => ({
        url: 'history',
        params: {
          slug: params.slug,
          type: params.type,
          branch: params.branch,
        },
      }),
      // ✅ No transformResponse - relies on default JSON parsing which respects backend's Camel Case
      providesTags: (_result, _error, arg) => [
        { type: 'History', id: `${arg.slug}-${arg.type}` },
      ],
    }),

    // GET /snapshot/{commitId}
    // Uses GetSnapshotByCommitParams (extends ResourceContextRequest with commitId)
    // No transformResponse needed - backend returns Camel Case JSON directly
    getSnapshotByCommit: builder.query<EntitySnapshot, GetSnapshotByCommitParams>({
      query: (params) => ({
        url: `snapshot/${params.commitId}`,
        params: {
          slug: params.slug,
          type: params.type,
          branch: params.branch,
        },
      }),
      // ✅ No transformResponse - relies on default JSON parsing which respects backend's Camel Case
      providesTags: (_result, _error, arg) => [
        { type: 'Snapshot', id: `${arg.slug}-${arg.type}-${arg.commitId}` },
      ],
    }),

    // GET /branches
    // No transformResponse needed - backend returns Camel Case JSON directly
    getBranches: builder.query<Branch[], void>({
      query: () => ({
        url: 'branches',
      }),
      // ✅ No transformResponse - relies on default JSON parsing which respects backend's Camel Case
      providesTags: [{ type: 'Branch', id: 'LIST' }],
    }),

    // POST /branch/create
    createBranch: builder.mutation<CreateBranchResponse, CreateBranchRequest>({
      query: (body) => ({
        url: 'branch/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, error) => {
        if (error) {
          return []
        }
        // Invalidate branch list to trigger refresh
        return [{ type: 'Branch', id: 'LIST' }]
      },
    }),

    // POST /revert
    revert: builder.mutation<RevertResponse, RevertRequest>({
      query: (body) => ({
        url: 'revert',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, error, arg) => {
        if (error) {
          return []
        }
        // Invalidate snapshot and history for the reverted entity
        return [
          { type: 'Snapshot', id: `${arg.slug}-${arg.type}` },
          { type: 'History', id: `${arg.slug}-${arg.type}` },
          { type: 'Entity', id: 'LIST' },
        ]
      },
    }),

    // POST /merge
    merge: builder.mutation<MergeResponse, MergeRequest>({
      query: (body) => ({
        url: 'merge',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, error) => {
        if (error) {
          return []
        }
        // Invalidate all caches to ensure fresh data after merge
        return [
          { type: 'Entity', id: 'LIST' },
          { type: 'Snapshot', id: 'LIST' },
          { type: 'History', id: 'LIST' },
          { type: 'Branch', id: 'LIST' },
        ]
      },
    }),

    // GET /search
    search: builder.query<SearchResult[], SearchRequest>({
      query: (params) => {
        const searchParams = new URLSearchParams()
        searchParams.append('query', params.query)
        if (params.branch) {
          searchParams.append('branch', params.branch)
        }
        if (params.type) {
          searchParams.append('type', params.type)
        }
        return {
          url: 'search',
          params: searchParams,
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Search', id: arg.query },
      ],
    }),

    // GET /process/recent
    getRecentProcesses: builder.query<ProcessRecord[], { limit?: number }>({
      query: (params) => {
        const searchParams = new URLSearchParams()
        if (params.limit) {
          searchParams.append('limit', params.limit.toString())
        }
        return {
          url: 'process/recent',
          params: searchParams,
        }
      },
      providesTags: [{ type: 'Process', id: 'RECENT' }],
    }),

    // GET /process/{processId}
    getProcessDetail: builder.query<ProcessDetail, string>({
      query: (processId) => ({
        url: `process/${processId}`,
      }),
      providesTags: (_result, _error, processId) => [
        { type: 'Process', id: processId },
      ],
    }),
  }),
})

export const {
  useGetEntitiesQuery,
  useGetSnapshotQuery,
  useBatchCommitMutation,
  useGetHistoryQuery,
  useGetSnapshotByCommitQuery,
  useGetBranchesQuery,
  useCreateBranchMutation,
  useRevertMutation,
  useMergeMutation,
  useSearchQuery,
  useLazySearchQuery,
  useGetRecentProcessesQuery,
  useGetProcessDetailQuery,
} = ubosApi

