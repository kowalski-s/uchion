import { create } from 'zustand'
import type { Worksheet, GeneratePayload } from '../../shared/types'

type SessionData = {
  payload: GeneratePayload
  worksheet: Worksheet
  pdfBase64: string | null
}

type Store = {
  sessions: Record<string, SessionData>
  currentSessionId: string | null
  saveSession: (id: string, data: SessionData) => void
  getSession: (id: string) => SessionData | undefined
  setCurrent: (id: string) => void
}

export const useSessionStore = create<Store>((set, get) => ({
  sessions: {},
  currentSessionId: null,
  saveSession: (id, data) => set(s => ({ sessions: { ...s.sessions, [id]: data } })),
  getSession: id => get().sessions[id],
  setCurrent: id => set({ currentSessionId: id })
}))
