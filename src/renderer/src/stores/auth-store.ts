import { create } from 'zustand'
import type { SafeUser } from '../../../shared/types'

interface AuthState {
  user: SafeUser | null
  login: (user: SafeUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null })
}))