# UBOS Studio - IDE-like Web Console

## 概述

UBOS Studio 是一个专业的 IDE 风格 Web 控制台，用于管理 UBOS (Git-for-Data) 系统的实体数据。

## 功能特性

### 1. 分屏 IDE 布局
- **侧边栏**: 导航菜单 (Entities, Commits, Branches, Settings)
- **左侧面板**: 实体网格 (Entity Grid)
- **右侧面板**: 快照编辑器 (Snapshot Editor)

### 2. 实体网格功能
- ✅ 使用 TanStack Table 构建的强大数据表格
- ✅ 显示实体信息: ID, Slug, Type, Branch
- ✅ 行选择复选框
- ✅ 批量操作工具栏 (当选择多行时显示):
  - Batch Commit (批量提交)
  - Diff Selected (对比选中项)
  - Merge (合并)
- ✅ 搜索过滤功能
- ✅ 点击行加载实体到编辑器

### 3. 快照编辑器功能
- ✅ Monaco Editor (VS Code 风格的 JSON 编辑器)
- ✅ 原始数据格式保持 (Raw JSON editing)
- ✅ 分支切换下拉菜单
- ✅ 提交更改功能 (带可选提交消息)
- ✅ 历史记录标签页 (Version Chain 可视化)

### 4. 技术栈
- React 18 + TypeScript + Vite
- Tailwind CSS (布局)
- Shadcn/UI (组件库)
- Monaco Editor (代码编辑器)
- TanStack Table (数据表格)
- Lucide React (图标)

## 项目结构

```
src/
├── components/
│   ├── ui/              # Shadcn/UI 基础组件
│   │   ├── button.tsx
│   │   ├── checkbox.tsx
│   │   ├── select.tsx
│   │   └── tabs.tsx
│   ├── Sidebar.tsx       # 侧边栏导航
│   ├── EntityGrid.tsx    # 实体网格表格
│   ├── SnapshotEditor.tsx # 快照编辑器
│   └── UBOSStudio.tsx    # 主布局组件
├── types/
│   └── ubos.ts           # TypeScript 接口定义
└── lib/
    └── utils.ts          # 工具函数
```

## TypeScript 接口

所有接口定义在 `src/types/ubos.ts`，匹配 Java 后端模型:

- `EntityInstance` - 实体实例
- `VersionChain` - 版本链
- `Branch` - 分支
- `CommitRequest` - 提交请求
- `BatchCommitRequest` - 批量提交请求
- `DiffResult` - 差异结果

## 使用说明

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`

### 主要操作流程

1. **查看实体**: 在左侧网格中浏览所有实体
2. **选择实体**: 点击表格行，右侧编辑器会加载该实体的快照数据
3. **编辑数据**: 在 Monaco Editor 中直接编辑 JSON
4. **切换分支**: 使用顶部的分支下拉菜单
5. **提交更改**: 编辑后点击 "Commit Changes" 按钮
6. **查看历史**: 切换到 "History" 标签页查看版本链
7. **批量操作**: 选中多个实体后，使用工具栏进行批量操作

## 连接后端 API

当前使用模拟数据。要连接真实后端，需要:

1. 在 `UBOSStudio.tsx` 中替换 `mockEntities` 为 API 调用
2. 实现 `handleCommit` 中的 API 请求
3. 实现分支切换时的数据获取

示例 API 调用:

```typescript
import { get, post } from '../ApiService'

// 获取实体列表
const entities = await get<EntityInstance[]>('/api/entities', { branch: currentBranch })

// 提交更改
await post('/api/entities/commit', {
  entityId: selectedEntity.id,
  snapshotData: editorValue,
  commitMessage,
  branch: currentBranch,
})
```

## 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 注意事项

- Monaco Editor 需要额外的配置才能在生产环境正常工作
- 当前使用模拟数据，需要连接真实后端 API
- 批量操作功能需要后端 API 支持

