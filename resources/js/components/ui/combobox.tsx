import {
    Combobox as HCombobox,
    ComboboxButton,
    ComboboxInput,
    ComboboxOption,
    ComboboxOptions,
} from '@headlessui/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

export interface ComboboxItem {
    value: string;
    label: string;
}

interface ComboboxProps {
    items: ComboboxItem[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    emptyText?: string;
    disabled?: boolean;
    className?: string;
    /** اتجاه فتح القائمة (للحقول قرب أسفل النافذة استخدم 'top start'). الافتراضي 'bottom start'. */
    anchor?: 'bottom start' | 'top start';
}

/**
 * قائمة منسدلة قابلة للبحث (Combobox) — عامّة لإعادة الاستخدام.
 * تُصفّي العناصر بحسب نصّ البحث، وتُرجع القيمة المختارة عبر onChange.
 */
export function Combobox({ items, value, onChange, placeholder = 'اختر', emptyText = 'لا توجد نتائج', disabled, className, anchor = 'bottom start' }: ComboboxProps) {
    const [query, setQuery] = useState('');

    const filtered = query === ''
        ? items
        : items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase().trim()));

    const selected = items.find((item) => item.value === value) ?? null;

    return (
        <HCombobox
            value={selected}
            onChange={(item: ComboboxItem | null) => onChange(item?.value ?? '')}
            disabled={disabled}
            immediate
            onClose={() => setQuery('')}
        >
            <div className={cn('relative', className)}>
                <div className="border-input bg-background focus-within:ring-ring relative flex h-10 w-full items-center rounded-md border focus-within:ring-2 focus-within:ring-offset-2">
                    <ComboboxInput
                        className="placeholder:text-muted-foreground h-full w-full rounded-md bg-transparent px-3 py-2 pl-9 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                        displayValue={(item: ComboboxItem | null) => item?.label ?? ''}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={placeholder}
                    />
                    <ComboboxButton className="absolute left-0 flex h-full items-center px-2">
                        <ChevronsUpDown className="size-4 opacity-50" />
                    </ComboboxButton>
                </div>
                <ComboboxOptions
                    anchor={anchor}
                    className="bg-popover text-popover-foreground pointer-events-auto z-[60] max-h-60 w-(--input-width) overflow-auto rounded-md border p-1 shadow-md empty:invisible [--anchor-gap:4px]"
                >
                    {filtered.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-1.5 text-sm">{emptyText}</div>
                    ) : (
                        filtered.map((item) => (
                            <ComboboxOption
                                key={item.value}
                                value={item}
                                className="data-focus:bg-accent data-focus:text-accent-foreground relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden"
                            >
                                <span className="absolute left-2 flex size-3.5 items-center justify-center">
                                    {item.value === value && <Check className="size-4" />}
                                </span>
                                {item.label}
                            </ComboboxOption>
                        ))
                    )}
                </ComboboxOptions>
            </div>
        </HCombobox>
    );
}
