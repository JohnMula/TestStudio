import {
  ListChecks,
  ToggleLeft,
  Type,
  ArrowLeftRight,
  TextCursorInput,
  ListOrdered,
  PenLine,
  type LucideIcon,
} from 'lucide-react'
import type { QType } from '@/lib/store'

export const TYPE_ICON: Record<QType, LucideIcon> = {
  multiple_choice: ListChecks,
  true_false: ToggleLeft,
  identification: Type,
  matching: ArrowLeftRight,
  fill_blank: TextCursorInput,
  enumeration: ListOrdered,
  essay: PenLine,
}
