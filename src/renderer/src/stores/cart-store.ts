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
  serviceCharge: number
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
  setServiceCharge: (v: number) => void
  addLine: (line: Omit<CartLine, 'key' | 'quantity' | 'note'>, qty?: number) => void
  setQuantity: (key: string, qty: number) => void
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
  serviceCharge: 0,
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
  setServiceCharge: (v) => set({ serviceCharge: Math.max(0, Math.round(v) || 0) }),

  // qty lets a big order (30 naan) go in with one action instead of 30 taps.
  addLine: (line, qty = 1) =>
    set((state) => {
      const add = Math.max(1, Math.round(qty) || 1)
      const key = `${line.productId}:${line.variantId ?? 'base'}`
      const existing = state.lines.find((l) => l.key === key)
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.key === key ? { ...l, quantity: l.quantity + add } : l
          )
        }
      }
      return { lines: [...state.lines, { ...line, key, quantity: add, note: '' }] }
    }),

  setQuantity: (key, qty) =>
    set((state) => {
      // Clearing the box mid-edit must not delete the line; the smallest a line
      // can go is 1.
      const n = Math.max(1, Math.round(qty) || 1)
      return { lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: n } : l)) }
    }),

  increment: (key) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
    })),

  // Minus stops at 1. Removing a line is the bin icon's job, so a stray tap on
  // minus never silently drops an item from the order.
  decrement: (key) =>
    set((state) => ({
      lines: state.lines.map((l) =>
        l.key === key ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l
      )
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
      serviceCharge: 0,
      lines: []
    })
}))

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
}