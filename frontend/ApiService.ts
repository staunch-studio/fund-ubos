import axios, { AxiosInstance, AxiosResponse } from 'axios';

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    // 统一错误处理
    if (error.response) {
      const { status } = error.response;
      switch (status) {
        case 401:
          console.error('未授权，请重新登录');
          // 可以跳转到登录页
          break;
        case 403:
          console.error('拒绝访问');
          break;
        case 404:
          console.error('请求的资源不存在');
          break;
        case 500:
          console.error('服务器内部错误');
          break;
        default:
          console.error(`请求错误: ${status}`);
      }
    } else if (error.request) {
      console.error('网络错误，无法连接到服务器');
    }
    return Promise.reject(error);
  }
);

export default api;

// 导出常用请求方法
export const get = <T>(url: string, params?: object): Promise<T> => {
  return api.get(url, { params });
};

export const post = <T>(url: string, data?: object): Promise<T> => {
  return api.post(url, data);
};

export const put = <T>(url: string, data?: object): Promise<T> => {
  return api.put(url, data);
};

export const del = <T>(url: string): Promise<T> => {
  return api.delete(url);
};
