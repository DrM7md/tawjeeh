import { ReportHeader, tone } from '@/components/visits/report-bits';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CalendarDays, ClipboardCheck, TrendingDown, TrendingUp } from 'lucide-react';

interface Subject {
    id: number;
    name: string;
    total_visits: number;
    rated_visits: number;
    unrated_visits: number;
    average_rating: number | null;
}
interface PageProps {
    subjects: Subject[];
    totals: { total: number; rated: number; average: number | null };
    best: Subject | null;
    worst: Subject | null;
    academicYear: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'الزيارات', href: '/visits' },
    { title: 'تقرير الأقسام', href: '/supervision-reports/department' },
];

export default function DepartmentReport({ subjects, totals, best, worst, academicYear }: PageProps) {
    const maxBar = 100;
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="تقرير أداء الأقسام" />
            <div className="flex flex-col gap-4 p-4 md:p-6">
                <ReportHeader title="تقرير أداء الأقسام" subtitle={`للعام الأكاديمي ${academicYear ?? ''}`} printUrl="/supervision-reports/print?type=department" />

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <SummaryCard icon={<ClipboardCheck className="size-5" />} label="عدد الزيارات الكلي" value={String(totals.total)} />
                    <SummaryCard label="الزيارات المقيّمة" value={String(totals.rated)} tone="text-blue-600" />
                    <SummaryCard label="المتوسط العام" value={totals.average != null ? `${totals.average}%` : '—'} tone={tone(totals.average)} />
                    <SummaryCard icon={<CalendarDays className="size-5" />} label="عدد الأقسام" value={String(subjects.length)} />
                </div>

                <Card>
                    <CardContent className="overflow-x-auto p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-primary text-primary-foreground">
                                    <th className="p-3 text-center">#</th>
                                    <th className="p-3 text-right">القسم</th>
                                    <th className="p-3 text-center">غير المقيّمة</th>
                                    <th className="p-3 text-center">المقيّمة</th>
                                    <th className="p-3 text-center">مجموع الزيارات</th>
                                    <th className="p-3 text-center">متوسط الأداء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map((s, i) => (
                                    <tr key={s.id} className={cn('border-b border-border/40', i % 2 && 'bg-muted/20')}>
                                        <td className="text-muted-foreground p-2.5 text-center tnum">{i + 1}</td>
                                        <td className="p-2.5 font-medium">{s.name}</td>
                                        <td className="p-2.5 text-center tnum">{s.unrated_visits}</td>
                                        <td className="p-2.5 text-center tnum">{s.rated_visits}</td>
                                        <td className="p-2.5 text-center font-bold tnum">{s.total_visits}</td>
                                        <td className={cn('p-2.5 text-center font-bold tnum', tone(s.average_rating))}>{s.average_rating != null ? `${s.average_rating}%` : '—'}</td>
                                    </tr>
                                ))}
                                {subjects.length === 0 && (
                                    <tr><td colSpan={6} className="text-muted-foreground p-8 text-center">لا توجد زيارات بعد</td></tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {(best || worst) && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {best && <Highlight up label="القسم الأعلى أداءً" name={best.name} v={best.average_rating} />}
                        {worst && <Highlight label="القسم الأدنى أداءً" name={worst.name} v={worst.average_rating} />}
                    </div>
                )}

                {/* رسم بياني للمتوسطات */}
                {subjects.some((s) => s.average_rating != null) && (
                    <Card>
                        <CardContent className="p-5">
                            <h3 className="mb-6 text-center font-bold">متوسط الأداء حسب القسم</h3>
                            <div className="flex items-end justify-around gap-2" style={{ minHeight: 260 }}>
                                {subjects.map((s) => {
                                    const v = s.average_rating ?? 0;
                                    const h = v > 0 ? Math.max((v / maxBar) * 230, 6) : 0;
                                    const bar = v >= 90 ? 'bg-green-500' : v >= 75 ? 'bg-blue-500' : v >= 60 ? 'bg-amber-500' : v > 0 ? 'bg-red-500' : 'bg-muted';
                                    return (
                                        <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
                                            {v > 0 && <span className="text-xs font-bold tnum">{v}%</span>}
                                            <div className={cn('w-full max-w-[44px] rounded-t', bar)} style={{ height: h }} title={`${s.name}: ${v}%`} />
                                            <span className="text-muted-foreground w-full break-words text-center text-[11px] leading-tight">{s.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}

function SummaryCard({ icon, label, value, tone: t }: { icon?: React.ReactNode; label: string; value: string; tone?: string }) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
                {icon && <span className="text-primary">{icon}</span>}
                <div className={cn('text-2xl font-bold tnum', t)}>{value}</div>
                <div className="text-muted-foreground text-xs">{label}</div>
            </CardContent>
        </Card>
    );
}

function Highlight({ up = false, label, name, v }: { up?: boolean; label: string; name: string; v: number | null }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-4">
                <div className={cn('flex size-10 items-center justify-center rounded-full', up ? 'bg-green-100 dark:bg-green-950' : 'bg-red-100 dark:bg-red-950')}>
                    {up ? <TrendingUp className="size-5 text-green-600" /> : <TrendingDown className="size-5 text-red-600" />}
                </div>
                <div className="flex-1">
                    <div className="text-muted-foreground text-xs">{label}</div>
                    <div className="font-bold">{name}</div>
                </div>
                <div className={cn('text-lg font-bold tnum', up ? 'text-green-600' : 'text-red-600')}>{v != null ? `${v}%` : '—'}</div>
            </CardContent>
        </Card>
    );
}
