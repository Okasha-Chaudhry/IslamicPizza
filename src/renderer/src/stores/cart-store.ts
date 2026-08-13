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
  editingOrderId: number | null
  editingOrderNumber: string | null
  orderType: OrderType
  tableId: number | null
  waiterId: number | null
  customerName: string
  customerPhone: string
  customerAddress: string
  discountAmount: number
  deliveryCharge: number
  lines: CartLine[]
  startEditing: (orderId: number, orderNumber: string) => void
  stopEditing: () => void
  setOrderType: (t: OrderType) => void
  setTableId: (id: number | null) => void
  setWaiterId: (id: number | null) => void
  setCustomerName: (v: string) => void
  setCustomerPhone: (v: string) => void
  setCustomerAddress: (v: string) => void
  setDiscountAmount: (v: number) => void
  setDeliveryCharge: (v: number) => void
  addLine: (line: Omit<CartLine, 'key' | 'quantity' | 'note'>) => void
  increment: (key: string) => void
  decrement: (key: string) => void
  removeLine: (key: string) => void
  setNote: (key: string, note: string) => void
  clear: () => void
}

export const useCartStore = create<CartState>((set) => ({
  editingOrderId: null,
  editingOrderNumber: null,
  orderType: 'take_away',
  tableId: null,
  waiterId: null,
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  discountAmount: 0,
  deliveryCharge: 0,
  lines: [],

  startEditing: (orderId, orderNumber) => set({ editingOrderId: orderId, editingOrderNumber: orderNumber }),
  stopEditing: () => set({ editingOrderId: null, editingOrderNumber: null }),
  setOrderType: (t) => set({ orderType: t }),
  setTableId: (id) => set({ tableId: id }),
  setWaiterId: (id) => set({ waiterId: id }),
  setCustomerName: (v) => set({ customerName: v }),
  setCustomerPhone: (v) => set({ customerPhone: v }),
  setCustomerAddress: (v) => set({ customerAddress: v }),
  setDiscountAmount: (v) => set({ discountAmount: Math.max(0, Math.round(v) || 0) }),
  setDeliveryCharge: (v) => set({ deliveryCharge: Math.max(0, Math.round(v) || 0) }),

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
      editingOrderId: null,
      editingOrderNumber: null,
      orderType: 'take_away',
      tableId: null,
      waiterId: null,
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      discountAmount: 0,
      deliveryCharge: 0,
      lines: []
    })
}))

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
}