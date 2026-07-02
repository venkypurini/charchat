import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api'),
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('chat_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('chat_user');
      localStorage.removeItem('chat_token');
      localStorage.removeItem('chat_offline_queue');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
