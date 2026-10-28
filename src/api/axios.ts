import axios from 'axios';
import { auth } from '../firebase';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const defaultApiUrl = import.meta.env.VITE_API_URL || (isLocalhost ? 'http://localhost:5000' : 'https://pharmacy-api-zyy0.onrender.com');

const api = axios.create({
  baseURL: defaultApiUrl.endsWith('/api') ? defaultApiUrl : `${defaultApiUrl}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🛡️ THE BEST Security Interceptor
api.interceptors.request.use(
  async (config) => {
    // 1. Try to get JWT from localStorage first (for Django/Custom Backend)
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      return config;
    }

    // 2. Fallback to Firebase ID token
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
