// src/utils/checkAuth.ts
import { useAuthStore } from '@/store/useAuthStore';

export const checkAuth = async () => {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        useAuthStore.getState().setIsLoggedIn(data.isLoggedIn);
    } catch {
        useAuthStore.getState().setIsLoggedIn(false);
    }
};
