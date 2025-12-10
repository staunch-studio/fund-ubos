# Fund UBOS 前端项目

基于 React + TypeScript + Vite 构建的前端应用。

## 📦 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Ant Design** - UI 组件库
- **Axios** - HTTP 客户端
- **React Router** - 路由管理
- **Zustand** - 状态管理

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

开发服务器将在 `http://localhost:3000` 启动。

### 3. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

### 4. 预览生产构建

```bash
npm run preview
```

### 5. 代码检查

```bash
npm run lint
```

## 📁 项目结构

```
frontend/
├── src/                    # 源代码目录
│   ├── api/               # API 服务
│   │   ├── api_health_logic_service.ts
│   │   ├── axios_api_service.ts
│   │   └── console.ts
│   ├── types/             # TypeScript 类型定义
│   │   └── ApiResponseInterfaces.ts
│   ├── App.tsx            # 主应用组件
│   ├── App.css            # 应用样式
│   ├── main.tsx           # 应用入口
│   └── index.css          # 全局样式
├── public/                # 静态资源
├── ApiService.ts          # API 服务配置（axios 实例）
├── vite.config.ts         # Vite 配置
├── tsconfig.json          # TypeScript 配置
└── package.json           # 项目依赖
```

## 🔧 配置说明

### API 代理配置

项目已配置 API 代理，所有 `/api` 开头的请求会被代理到后端服务器：

```typescript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',  // 后端服务器地址
      changeOrigin: true,
    }
  }
}
```

### 使用 API 服务

项目提供了统一的 API 服务 (`ApiService.ts`)，可以直接使用：

```typescript
import { get, post, put, del } from '../ApiService';

// GET 请求
const data = await get<ResponseType>('/endpoint', { params: 'value' });

// POST 请求
const result = await post<ResponseType>('/endpoint', { key: 'value' });

// PUT 请求
await put<ResponseType>('/endpoint', { key: 'value' });

// DELETE 请求
await del<ResponseType>('/endpoint');
```

API 服务已配置：
- 自动添加认证 token（从 localStorage 读取）
- 统一错误处理
- 请求超时设置（15秒）

## 📝 开发指南

1. **修改代码**：编辑 `src/` 目录下的文件
2. **热更新**：Vite 支持热模块替换（HMR），修改代码后会自动刷新
3. **类型检查**：使用 TypeScript 确保类型安全
4. **代码规范**：运行 `npm run lint` 检查代码规范

## 🌐 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
