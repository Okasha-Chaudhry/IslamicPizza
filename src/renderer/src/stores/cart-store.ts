import { create } from 'zustand'
import type { OrderType } from '../../../shared/types'

export interface CartLine {
  key: string
  productId: number
  variantId: number | null
  productName: string
  variantName: string | null
  unitPrice: number
  quantity: number
  note: string
}

interface CartState {
  orderType: OrderType
  tableId: number | null
  waiterId: number | null
  customerPhone: string
  customerAddress: string
  discountPercent: number
  lines: CartLine[]
  setOrderType: (t: OrderType) => void
  setTableId: (id: number | null) => void
  setWaiterId: (id: number | null) => void
  setCustomerPhone: (v: string) => void
  setCustomerAddress: (v: string) => void
  setDiscountPercent: (v: number) => void
  addLine: (line: Omit<CartLine, 'key' | 'quantity' | 'note'>) => void
  increment: (key: string) => void
  decrement: (key: string) => void
  removeLine: (key: string) => void
  setNote: (key: string, note: string) => void
  clear: () => void
}

export const useCartStore = create<CartState>((set) => ({
  orderType: 'take_away',
  tableId: null,
  waiterId: null,
  customerPhone: '',
  customerAddress: '',
  discountPercent: 0,
  lines: [],

  setOrderType: (t) => set({ orderType: t }),
  setTableId: (id) => set({ tableId: id }),
  setWaiterId: (id) => set({ waiterId: id }),
  setCustomerPhone: (v) => set({ customerPhone: v }),
  setCustomerAddress: (v) => set({ customerAddress: v }),
  setDiscountPercent: (v) =>
    set({ discountPercent: Math.max(0, Math.min(100, Math.round(v) || 0)) }),

  addLine: (line) =>
    set((state) => {
      const key = `${line.productId}:${line.variantId ?? 'base'}`
      const existing = state.lines.find((l) => l.key === key)
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.key === key ? { ...l, quantity: l.quantity + 1 } : l
          )
        }
      }
      return { lines: [...state.lines, { ...line, key, quantity: 1, note: '' }] }
    }),

  increment: (key) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
    })),

  decrement: (key) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    })),

  removeLine: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),

  setNote: (key, note) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.key === key ? { ...l, note } : l))
    })),

  clear: () =>
    set({
      orderType: 'take_away',
      tableId: null,
      waiterId: null,
      customerPhone: '',
      customerAddress: '',
      discountPercent: 0,
      lines: []
    })
}))

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
}