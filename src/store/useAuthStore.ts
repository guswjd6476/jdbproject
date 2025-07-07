import { create } from 'zustand';

interface AuthState {
    isLoggedIn: boolean;
    setIsLoggedIn: (status: boolean) => void;
    login: () => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    isLoggedIn: false,
    setIsLoggedIn: (status) => set({ isLoggedIn: status }),
    login: () => set({ isLoggedIn: true }),
    logout: () => set({ isLoggedIn: false }),
}));
