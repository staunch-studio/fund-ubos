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
  SchemaCommitRequest,
  SchemaCommitResponse,
  CreateApprovalRequest,
  CreateApprovalRequestResponse,
  ApprovalActionRequest,
  ApprovalActionResponse,
  ApprovalRequestDetail,
  ApproveRequest, // Legacy alias
  ApproveRequestResponse, // Legacy alias
  NavigateEntitiesParams,
  RenameEntityRequest,
  RenameEntityResponse,
  CopyEntityRequest,
  CopyEntityResponse,
  BranchStatusParams,
  BranchStatusResponse,
  EntityStatus,
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
  tagTypes: ['Entity', 'Snapshot', 'History', 'Branch', 'Search', 'Process', 'Environment', 'Schema', 'Approval'],
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

    // GET /entities/navigate
    // Returns entities organized by namespace for tree navigation
    navigateEntities: builder.query<EntityInstance[], NavigateEntitiesParams>({
      query: (params) => {
        const searchParams = new URLSearchParams()
        searchParams.append('branch', params.branch)
        if (params.type) {
          searchParams.append('type', params.type)
        }
        if (params.namespace) {
          searchParams.append('namespace', params.namespace)
        }
        return {
          url: 'entities/navigate',
          params: searchParams,
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Entity' as const, id })),
              { type: 'Entity', id: 'NAVIGATE' },
            ]
          : [{ type: 'Entity', id: 'NAVIGATE' }],
    }),

    // GET /snapshot
    // Supports two modes:
    // - URI mode: GET /snapshot?uri=ubos://logic/tax-calc?branch=master
    // - Standard mode: GET /snapshot?type=LOGIC&slug=tax-calc&branch=master
    // Accepts either a full UBOS URI string or ResourceContextRequest
    getSnapshot: builder.query<EntitySnapshot, string | ResourceContextRequest>({
      query: (arg) => {
        // Check if arg is a string (URI mode) or object (Standard mode)
        if (typeof arg === 'string') {
          // URI mode
          return {
            url: 'snapshot',
            params: {
              uri: arg,
            },
          }
        } else {
          // Standard mode
          return {
            url: 'snapshot',
            params: {
              type: arg.type,
              slug: arg.slug,
              branch: arg.branch,
            },
          }
        }
      },
      // ✅ No transformResponse - relies on default JSON parsing which respects backend's Camel Case
      providesTags: (_result, _error, arg) => {
        if (typeof arg === 'string') {
          return [{ type: 'Snapshot', id: arg }]
        } else {
          return [{ type: 'Snapshot', id: `${arg.slug}-${arg.type}-${arg.branch}` }]
        }
      },
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
          { type: 'Snapshot', id: `${arg.slug}-${arg.type || 'LOGIC'}` },
          { type: 'History', id: `${arg.slug}-${arg.type || 'LOGIC'}` },
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
        if (params.mode) {
          searchParams.append('mode', params.mode)
        }
        if (params.limit) {
          searchParams.append('limit', params.limit.toString())
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

    // Note: Environment management is now handled via standard entity queries
    // GET /entities?type=ENVIRONMENT - use getEntitiesQuery with type='ENVIRONMENT'
    // POST /batch-commit with type='ENVIRONMENT' - use batchCommitMutation
    // The old /environments and /environment/save endpoints may still exist on the backend
    // for backward compatibility, but the frontend now uses the standard entity commit flow

    // GET /snapshot?type=SCHEMA&slug={entityType}&branch={branch}
    // Uses ResourceContextRequest to fetch schema as a snapshot entity
    getSchema: builder.query<EntitySnapshot, ResourceContextRequest & { entityType: string }>({
      query: (params) => ({
        url: 'snapshot',
        params: {
          slug: params.entityType, // Schema slug is the entity type
          type: 'SCHEMA',
          branch: params.branch,
        },
      }),
      providesTags: (_result, _error, arg) => [
        { type: 'Schema', id: `${arg.entityType}-${arg.branch}` },
      ],
    }),

    // POST /schema/commit
    commitSchema: builder.mutation<SchemaCommitResponse, SchemaCommitRequest>({
      query: (body) => ({
        url: 'schema/commit',
        method: 'POST',
        body: {
          targetType: body.targetType,
          jsonSchemaContent: body.jsonSchemaContent,
          branch: body.branch || 'master',
          author: body.author || 'system',
          message: body.message,
        },
      }),
      invalidatesTags: (_result, error, arg) => {
        if (error) {
          return []
        }
        // Invalidate schema snapshot and entity list
        return [
          { type: 'Schema', id: `${arg.targetType}-${arg.branch || 'master'}` },
          { type: 'Entity', id: 'LIST' },
        ]
      },
    }),

    // POST /approval/request
    createApprovalRequest: builder.mutation<CreateApprovalRequestResponse, CreateApprovalRequest>({
      query: (body) => ({
        url: 'approval/request',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, error) => {
        if (error) {
          return []
        }
        // Invalidate approval list and entity list
        return [
          { type: 'Approval', id: 'LIST' },
          { type: 'Entity', id: 'LIST' },
        ]
      },
    }),

    // POST /approval/approve
    // Handles both approve and reject actions based on action field
    approveRequest: builder.mutation<ApprovalActionResponse, ApprovalActionRequest>({
      query: (body) => ({
        url: 'approval/approve',
        method: 'POST',
        body: {
          requestId: body.requestId,
          approver: body.approver || 'system',
          action: body.action,
          ...(body.reason && { reason: body.reason }),
        },
      }),
      invalidatesTags: (_result, error, arg) => {
        if (error) {
          return []
        }
        // Invalidate approval list, entity list, and snapshots for the specific approval request
        // We invalidate snapshots using the requestId (which is the slug) to ensure
        // ApprovalRequestRow components refetch their snapshot data
        return [
          { type: 'Approval', id: 'LIST' },
          { type: 'Approval', id: arg.requestId },
          { type: 'Entity', id: 'LIST' },
          // Invalidate snapshot for the specific approval request entity
          // The tag format matches what getSnapshot providesTags returns
          // For URI mode: tag is the full URI string
          // For standard mode: tag is `${slug}-${type}-${branch}`
          // We can't know the exact branch here, so we invalidate Entity LIST
          // and let the component-level invalidation handle specific snapshots
        ]
      },
    }),

    // GET /approval/pending
    getPendingApprovals: builder.query<ApprovalRequestDetail[], { status?: string }>({
      query: (params) => {
        const searchParams = new URLSearchParams()
        if (params.status) {
          searchParams.append('status', params.status)
        }
        return {
          url: 'approval/pending',
          params: searchParams,
        }
      },
      providesTags: [{ type: 'Approval', id: 'LIST' }],
    }),

    // GET /approval/{requestId}
    getApprovalDetail: builder.query<ApprovalRequestDetail, string>({
      query: (requestId) => ({
        url: `approval/${requestId}`,
      }),
      providesTags: (_result, _error, requestId) => [
        { type: 'Approval', id: requestId },
      ],
    }),

    // POST /approval/{requestId}/cancel
    cancelApprovalRequest: builder.mutation<{ success: boolean; message: string; requestId: string; status: string }, { requestId: string; author: string }>({
      query: ({ requestId, author }) => ({
        url: `approval/${requestId}/cancel`,
        method: 'POST',
        params: {
          author,
        },
      }),
      invalidatesTags: (_result, error, arg) => {
        if (error) {
          return []
        }
        return [
          { type: 'Approval', id: 'LIST' },
          { type: 'Approval', id: arg.requestId },
        ]
      },
    }),
  }),
})

export const {
  useGetEntitiesQuery,
  useNavigateEntitiesQuery,
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
  useGetSchemaQuery,
  useCommitSchemaMutation,
  useCreateApprovalRequestMutation,
  useApproveRequestMutation,
  useGetPendingApprovalsQuery,
  useGetApprovalDetailQuery,
  useCancelApprovalRequestMutation,
  useRenameEntityMutation,
  useCopyEntityMutation,
  useGetBranchStatusQuery,
} = ubosApi

