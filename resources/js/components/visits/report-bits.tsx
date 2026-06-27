import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { ArrowRight, Printer, TrendingDown, TrendingUp } from 'lucide-react';

/** لون النسبة حسب المستوى (موحّد عبر كل التقارير). */
export function tone(v: number | null | undefined): string {
    if (v == null) return 'text-muted-foreground';
    if (v >= 90) return 'text-green-600';
    if (v >= 75) return 'text-blue-600';
    if (v >= 60) return 'text-amber-600';
    if (v >= 50) return 'text-orange-600';
    return 'text-red-600';
}

export function bgTone(v: number | null | undefined): string {
    if (v == null) return 'bg-muted text-muted-foreground';
    if (v >= 90) return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
    if (v >= 75) return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
    if (v >= 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
    if (v >= 50) return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
    return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
}

export const Pct = ({ v }: { v: number | null | undefined }) =>
    v == null ? <span className="text-muted-foreground">—</span> : <span className={cn('font-bold tnum', tone(v))}>{v}%</span>;

export function Improvement({ v }: { v: number | null | undefined }) {
    if (v == null) return <span className="text-muted-foreground text-xs">—</span>;
    if (v === 0) return <span className="text-muted-foreground text-xs tnum">0%</span>;
    const up = v > 0;
    return (
        <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold tnum', up ? 'text-green-600' : 'text-red-600')}>
            {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {up ? '+' : ''}{v}%
        </span>
    );
}

/** رأس صفحة التقرير: عنوان + رجوع للزيارات + زر طباعة. */
export function ReportHeader({ title, subtitle, printUrl }: { title: string; subtitle?: string; printUrl?: string }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div>
                <h1 className="text-primary text-2xl font-bold">{title}</h1>
                {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
                {printUrl && (
                    <a href={printUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">
                            <Printer className="size-4" /> طباعة
                        </Button>
                    </a>
                )}
                <Button variant="outline" size="sm" asChild>
                    <Link href="/visits">
                        العودة للزيارات <ArrowRight className="size-4" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}

/** قائمة منسدلة تُعيد تحميل الصفحة بمعاملات جديدة (مثل المرجع). */
export function ReportSelect({
    value,
    placeholder,
    options,
    onChange,
    className,
}: {
    value: string;
    placeholder: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
    className?: string;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn('min-w-[200px]', className)}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** يتنقّل لمسار التقرير بمعاملات (يستبدل الحالة كاملة مثل المرجع). */
export function navigate(path: string, params: Record<string, string | number | undefined>) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') clean[k] = String(v);
    router.get(path, clean, { preserveState: false });
}
