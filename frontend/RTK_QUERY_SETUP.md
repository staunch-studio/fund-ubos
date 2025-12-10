# UBOS Studio - RTK Query Integration

## 概述

UBOS Studio 已成功集成 Redux Toolkit Query (RTK Query) 用于连接真实的后端 API。所有模拟数据已移除，现在使用真实的 API 端点。

## 技术栈

- **React 18** + **TypeScript**
- **Redux Toolkit Query** - 数据获取和状态管理
- **Ant Design** - UI 组件库（Table, Select, Button 等）
- **Monaco Editor** - JSON 编辑器
- **Vite** - 构建工具

## API 配置

### Base URL
所有 API 请求的基础路径：`/api/console`

### 代理配置
Vite 开发服务器将 `/api` 请求代理到 `http://localhost:8080`

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
  }
}
```

## API 端点

### 1. GET /entities
获取实体列表

**参数：**
- `branch` (string, required) - 分支名称
- `type` (string, optional) - 实体类型过滤
- `search` (string, optional) - 搜索关键词

**返回：** `EntityInstance[]`

**使用：**
```typescript
const { data, isLoading, error } = useGetEntitiesQuery({
  branch: 'master',
  search: 'keyword',
  type: 'UserProfile',
})
```

### 2. GET /snapshot
获取实体快照数据

**参数：**
- `slug` (string, required) - 实体 slug
- `branch` (string, required) - 分支名称

**返回：** `EntitySnapshot`

**使用：**
```typescript
const { data, isLoading } = useGetSnapshotQuery(
  { slug: 'entity-slug', branch: 'master' },
  { skip: !entity?.slug }
)
```

### 3. POST /batch-commit
批量提交更改

**请求体：**
```typescript
{
  slugs: string[],
  branch: string,
  jsonPatch: string,
  message: string
}
```

**返回：** `BatchCommitResponse`

**使用：**
```typescript
const [batchCommit, { isLoading }] = useBatchCommitMutation()

await batchCommit({
  slugs: ['entity-1', 'entity-2'],
  branch: 'master',
  jsonPatch: '[]',
  message: 'Batch commit message',
}).unwrap()
```

## Redux Store 配置

### Store 结构
```typescript
// src/store/store.ts
export const store = configureStore({
  reducer: {
    [ubosApi.reducerPath]: ubosApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(ubosApi.middleware),
})
```

### Provider 设置
```typescript
// src/main.tsx
<Provider store={store}>
  <App />
</Provider>
```

## 标签管理 (Tag Management)

RTK Query 使用标签系统自动管理缓存失效：

- **Entity 标签：** 当批量提交成功时，自动刷新实体列表
- **Snapshot 标签：** 每个快照按 `slug-branch` 组合缓存

### 自动刷新机制
当 `batchCommit` mutation 成功时，`invalidatesTags` 会自动触发 `getEntities` 查询的重新获取，确保 UI 显示最新的数据。

## 组件说明

### EntityManager.tsx
- 使用 Ant Design Table 显示实体列表
- 支持行选择和批量操作
- 集成搜索和分支过滤
- 使用 `useGetEntitiesQuery` 获取数据
- 使用 `useBatchCommitMutation` 提交更改

### SnapshotEditor.tsx
- 使用 Monaco Editor 显示和编辑 JSON
- 使用 `useGetSnapshotQuery` 获取快照数据
- `snapshotData` 作为原始字符串处理，不进行 JSON 解析
- 支持分支切换和历史记录查看

### UBOSStudio.tsx
- 主布局组件
- 管理全局状态（选中的实体、当前分支）
- 集成 Ant Design 的 ConfigProvider

## 类型定义

所有类型定义在 `src/types/ubos.ts`：

```typescript
export interface EntityInstance {
  id: string
  entityType: string
  slug: string
  createdAt: string
  branch?: string
}

export interface EntitySnapshot {
  commitId: number
  entityId: string
  branchName: string
  snapshotData: string // RAW JSON String
  authorId: string
  message: string
  createdAt?: string
}
```

## 重要注意事项

1. **snapshotData 处理：** `snapshotData` 在 Redux 层保持为字符串，只在 Monaco Editor 中格式化为 JSON 显示。不要在前端解析它。

2. **认证：** 后端使用 IP 白名单（127.0.0.1），不需要 Authorization headers。

3. **错误处理：** 所有 RTK Query hooks 都提供 `error` 状态，组件中已实现错误显示。

4. **加载状态：** 使用 `isLoading` 状态显示加载指示器。

5. **自动刷新：** 批量提交成功后，实体列表会自动刷新（通过 `invalidatesTags`）。

## 开发工作流

1. **启动开发服务器：**
   ```bash
   npm run dev
   ```

2. **确保后端运行在：** `http://localhost:8080`

3. **访问应用：** `http://localhost:3000`

4. **测试流程：**
   - 选择分支
   - 查看实体列表
   - 选择实体查看快照
   - 编辑 JSON
   - 批量提交更改

## 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

