import api from './index';

// 示例：获取健康检查
export const getHealth = () => {
  return api.get('/actuator/health');
};

// 示例：运行逻辑
export const runLogic = (params: {
  logicSlug: string;
  branch?: string;
  commitId?: number;
  context?: Record<string, unknown>;
}) => {
  return api.post('/runtime/logic', params);
};

// 根据你的后端 API 添加更多方法...
