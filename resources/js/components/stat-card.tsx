import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

type Tone = 'primary' | 'success' | 'warning' | 'destructive' | 'info';

const toneStyles: Record<Tone, { bar: string; iconBg: string; iconText: string }> = {
    primary: { bar: 'from-primary/0 via-primary to-primary/0', iconBg: 'bg-primary/10', iconText: 'text-primary' },
    success: { bar: 'from-success/0 via-success to-success/0', iconBg: 'bg-success/10', iconText: 'text-success' },
    warning: { bar: 'from-warning/0 via-warning to-warning/0', iconBg: 'bg-warning/10', iconText: 'text-warning' },
    destructive: { bar: 'from-destructive/0 via-destructive to-destructive/0', iconBg: 'bg-destructive/10', iconText: 'text-destructive' },
    info: { bar: 'from-chart-4/0 via-chart-4 to-chart-4/0', iconBg: 'bg-chart-4/10', iconText: 'text-chart-4' },
};

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: LucideIcon;
    tone?: Tone;
    hint?: string;
    trend?: { value: string; positive?: boolean };
    className?: string;
}

/**
 * البطاقة الإحصائية — الميزة المميّزة لنظام التصميم.
 * تأثير زجاجي + شريط تدرّج علوي حسب اللون + أيقونة في مربّع ملوّن + رفع عند المرور.
 */
export function StatCard({ title, value, icon: Icon, tone = 'primary', hint, trend, className }: StatCardProps) {
    const t = toneStyles[tone];

    return (
        <div className={cn('glass hover-lift relative overflow-hidden rounded-2xl border border-border/60 p-5', className)}>
            {/* شريط التدرّج العلوي */}
            <div className={cn('absolute inset-x-0 top-0 h-[2px] bg-gradient-to-l', t.bar)} />

            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <p className="text-muted-foreground truncate text-sm font-medium">{title}</p>
                    <p className="tnum text-2xl font-bold tracking-tight">{value}</p>
                    {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
                </div>

                {Icon && (
                    <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
                        <Icon className={cn('size-5', t.iconText)} />
                    </div>
                )}
            </div>

            {trend && (
                <p className={cn('mt-3 text-xs font-medium', trend.positive ? 'text-success' : 'text-destructive')}>
                    {trend.value}
                </p>
            )}
        </div>
    );
}
