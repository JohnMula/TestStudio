'use client'

import { QUESTION_TYPES, type QType } from '@/lib/store'

export function TypePicker({
  value,
  onChange,
}: {
  value: QType
  onChange: (type: QType) => void
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">Question type</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as QType)}
        className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 sm:max-w-sm"
      >
        {QUESTION_TYPES.map((type) => (
          <option key={type.type} value={type.type}>
            {type.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        New questions use this type. Existing questions keep their saved type.
      </span>
    </label>
  )
}
