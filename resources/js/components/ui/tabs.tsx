import { cn } from '@/lib/utils';
import { createContext, useContext, useState, type ReactNode } from 'react';

interface TabsContextValue {
    value: string;
    setValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
    const ctx = useContext(TabsContext);
    if (!ctx) throw new Error('Tabs components must be used within <Tabs>');
    return ctx;
}

interface TabsProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    className?: string;
}

/** تابات خفيفة بالحالة (بلا اعتماديات) — تدعم الوضعين المتحكَّم وغير المتحكَّم. */
export function Tabs({ defaultValue = '', value, onValueChange, children, className }: TabsProps) {
    const [internal, setInternal] = useState(defaultValue);
    const current = value ?? internal;
    const setValue = (v: string) => {
        onValueChange?.(v);
        if (value === undefined) setInternal(v);
    };

    return (
        <TabsContext.Provider value={{ value: current, setValue }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm', className)}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
    const ctx = useTabs();
    const active = ctx.value === value;
    return (
        <button
            type="button"
            onClick={() => ctx.setValue(value)}
            className={cn(
                'rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
                className,
            )}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
    const ctx = useTabs();
    if (ctx.value !== value) return null;
    return <div className={className}>{children}</div>;
}
