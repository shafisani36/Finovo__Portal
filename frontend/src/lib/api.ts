import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Normalize redundant /api/v1 prefixes if supplied by callers
  if (config.url) {
    if (config.url.startsWith('/api/v1/')) {
      config.url = config.url.replace('/api/v1/', '/');
    } else if (config.url.startsWith('api/v1/')) {
      config.url = config.url.replace('api/v1/', '/');
    }
  }

  const token = localStorage.getItem('bitspark_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: Record<string, string[]> }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bitspark_token');
      localStorage.removeItem('bitspark_user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;
