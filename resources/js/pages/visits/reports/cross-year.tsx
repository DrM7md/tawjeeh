import { bgTone, ReportHeader, tone } from '@/components/visits/report-bits';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { Fragment } from 'react';

interface YearSummary {
    year_id: number; year_name: string; total_visits: number; avg_rating: number | null;
    teacher_count: number; subject_count: number; full_visits: number; partial_visits: number;
}
interface RatingDist { year_id: number; year_name: string; total: number; excellent: number; very_good: number; good: number; acceptable: number; weak: number }
interface SubjectYears { id: number; name: string; years: Record<number, { avg: number | null; visits: number } | null> }
interface TeacherHighlight { year_id: number; year_name: string; best: { name: string; avg: number }; worst: { name: string; avg: number } }
interface MonthlyDist { year_id: number; year_name: string; months: Record<number, number> }
interface VisitorStat { year_id: number; year_name: string; visitors: { name: string; role: string; visits: number; avg: number | null }[] }
interface PageProps {
    yearSummaries: YearSummary[];
    ratingDistribution: RatingDist[];
    subjectAcrossYears: SubjectYears[];
    teacherHighlights: TeacherHighlight[];
    monthlyDistribution: MonthlyDist[];
    visitorStats: VisitorStat[];
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const YEAR_BAR = ['bg-primary', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'الزيارات', href: '/visits' },
    { title: 'الإحصائيات الشاملة', href: '/supervision-reports/cross-year' },
];

export default function CrossYearStatistics({ yearSummaries, ratingDistribution, subjectAcrossYears, teacherHighlights, monthlyDistribution, visitorStats }: PageProps) {
    if (yearSummaries.length === 0) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="إحصائيات شاملة" />
                <div className="p-4 md:p-6">
                    <ReportHeader title="إحصائيات شاملة للزيارات الإشرافية" subtitle="مقارنات عبر جميع الأعوام الدراسية" printUrl="/supervision-reports/print?type=cross-year" />
                    <Card className="mt-4"><CardContent className="text-muted-foreground p-12 text-center">لا توجد بيانات زيارات</CardContent></Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="إحصائيات شاملة" />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <ReportHeader title="إحصائيات شاملة للزيارات الإشرافية" subtitle="مقارنات عبر جميع الأعوام الدراسية" printUrl="/supervision-reports/print?type=cross-year" />

                {/* 1. بطاقات ملخص كل عام */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {yearSummaries.map((s) => (
                        <Card key={s.year_id} className="overflow-hidden p-0">
                            <div className="bg-primary text-primary-foreground px-4 py-2.5 font-bold">{s.year_name}</div>
                            <CardContent className="grid grid-cols-2 gap-3 p-4">
                                <Mini value={String(s.total_visits)} label="إجمالي الزيارات" accent />
                                <Mini value={s.avg_rating != null ? `${s.avg_rating}%` : '—'} label="المعدّل العام" tone={tone(s.avg_rating)} />
                                <Mini value={String(s.teacher_count)} label="معلم" />
                                <Mini value={String(s.subject_count)} label="قسم" />
                                <div className="col-span-2 flex items-center justify-center gap-4 border-t border-border/60 pt-2 text-xs">
                                    <span><span className="font-bold text-blue-600">{s.full_visits}</span> مقيّمة</span>
                                    <span><span className="font-bold text-amber-600">{s.partial_visits}</span> غير مقيّمة</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* 2. مقارنة المعدّل العام عبر الأعوام */}
                <Card>
                    <CardContent className="p-5">
                        <h2 className="text-primary mb-4 flex items-center gap-2 text-lg font-bold"><BarChart3 className="size-5" /> مقارنة المعدّل العام عبر الأعوام</h2>
                        <div className="flex items-end justify-around gap-2" style={{ minHeight: 240 }}>
                            {yearSummaries.map((s, idx) => {
                                const h = s.avg_rating != null ? Math.max((s.avg_rating / 100) * 200, 20) : 20;
                                return (
                                    <div key={s.year_id} className="flex max-w-[120px] flex-1 flex-col items-center">
                                        <span className={cn('mb-1 text-sm font-bold tnum', tone(s.avg_rating))}>{s.avg_rating != null ? `${s.avg_rating}%` : '—'}</span>
                                        <div className={cn('w-full rounded-t-lg', YEAR_BAR[idx % YEAR_BAR.length])} style={{ height: h }} />
                                        <div className="mt-2 break-words text-center text-xs font-medium">{s.year_name}</div>
                                        <div className="text-muted-foreground text-[10px]">{s.total_visits} زيارة</div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* 3. توزيع التقديرات */}
                {ratingDistribution.length > 0 && (
                    <Card>
                        <CardContent className="overflow-x-auto p-5">
                            <h2 className="text-primary mb-4 text-lg font-bold">توزيع تقديرات الأداء عبر الأعوام</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="p-2 text-right">العام</th>
                                        <th className="p-2 text-center text-green-700">ممتاز<br /><span className="text-[10px] font-normal">+90%</span></th>
                                        <th className="p-2 text-center text-blue-700">جيد جدًا<br /><span className="text-[10px] font-normal">75-89%</span></th>
                                        <th className="p-2 text-center text-amber-700">جيد<br /><span className="text-[10px] font-normal">60-74%</span></th>
                                        <th className="p-2 text-center text-orange-700">مقبول<br /><span className="text-[10px] font-normal">50-59%</span></th>
                                        <th className="p-2 text-center text-red-700">ضعيف<br /><span className="text-[10px] font-normal">&lt;50%</span></th>
                                        <th className="p-2 text-center">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ratingDistribution.map((rd, i) => (
                                        <tr key={rd.year_id} className={cn('border-b border-border/40', i % 2 && 'bg-muted/20')}>
                                            <td className="p-2 font-bold">{rd.year_name}</td>
                                            <DistCell n={rd.excellent} total={rd.total} className="text-green-600" />
                                            <DistCell n={rd.very_good} total={rd.total} className="text-blue-600" />
                                            <DistCell n={rd.good} total={rd.total} className="text-amber-600" />
                                            <DistCell n={rd.acceptable} total={rd.total} className="text-orange-600" />
                                            <DistCell n={rd.weak} total={rd.total} className="text-red-600" />
                                            <td className="p-2 text-center font-bold tnum">{rd.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {/* 4. أداء الأقسام عبر الأعوام */}
                {subjectAcrossYears.length > 0 && (
                    <Card>
                        <CardContent className="overflow-x-auto p-5">
                            <h2 className="text-primary mb-4 text-lg font-bold">أداء الأقسام عبر الأعوام</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-sky-600 text-white">
                                        <th className="p-2 text-right">القسم</th>
                                        {yearSummaries.map((s) => <th key={s.year_id} className="p-2 text-center" colSpan={2}>{s.year_name}</th>)}
                                        <th className="p-2 text-center">الاتجاه</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjectAcrossYears.map((sub, sIdx) => {
                                        const vals = yearSummaries.map((s) => sub.years[s.year_id]?.avg).filter((v): v is number => v != null);
                                        const trend = vals.length >= 2 ? Math.round((vals[vals.length - 1] - vals[0]) * 10) / 10 : null;
                                        return (
                                            <tr key={sub.id} className={cn('border-b border-border/40', sIdx % 2 && 'bg-muted/20')}>
                                                <td className="p-2 font-bold">{sub.name}</td>
                                                {yearSummaries.map((s) => {
                                                    const d = sub.years[s.year_id];
                                                    return (
                                                        <Fragment key={s.year_id}>
                                                            <td className={cn('p-2 text-center font-bold tnum', d?.avg != null ? tone(d.avg) : 'text-muted-foreground/40')}>{d?.avg != null ? `${d.avg}%` : '—'}</td>
                                                            <td className="text-muted-foreground p-2 text-center text-xs tnum">{d?.visits ?? '—'}</td>
                                                        </Fragment>
                                                    );
                                                })}
                                                <td className="p-2 text-center">
                                                    {trend != null ? (
                                                        <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold', trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                                                            {trend > 0 ? <TrendingUp className="size-4" /> : trend < 0 ? <TrendingDown className="size-4" /> : null}{trend > 0 ? '+' : ''}{trend}%
                                                        </span>
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {/* 5. أفضل/أدنى المعلمين لكل عام */}
                {teacherHighlights.length > 0 && (
                    <Card>
                        <CardContent className="p-5">
                            <h2 className="text-primary mb-4 text-lg font-bold">أفضل وأدنى المعلمين أداءً حسب العام</h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {teacherHighlights.map((th, idx) => (
                                    <div key={th.year_id} className="overflow-hidden rounded-lg border border-border/60">
                                        <div className={cn('px-3 py-2 text-sm font-bold text-white', YEAR_BAR[idx % YEAR_BAR.length])}>{th.year_name}</div>
                                        <div className="space-y-2 p-3">
                                            <HighlightRow up name={th.best.name} avg={th.best.avg} />
                                            <HighlightRow name={th.worst.name} avg={th.worst.avg} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* 6. التوزيع الشهري */}
                {monthlyDistribution.length > 0 && (
                    <Card>
                        <CardContent className="overflow-x-auto p-5">
                            <h2 className="text-primary mb-4 text-lg font-bold">التوزيع الشهري للزيارات</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="p-2 text-right">العام</th>
                                        {MONTHS.map((m, i) => <th key={i} className="p-1.5 text-center text-xs">{m.slice(0, 3)}</th>)}
                                        <th className="p-2 text-center">المجموع</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyDistribution.map((md, i) => {
                                        const total = Object.values(md.months).reduce((a, b) => a + b, 0);
                                        return (
                                            <tr key={md.year_id} className={cn('border-b border-border/40', i % 2 && 'bg-muted/20')}>
                                                <td className="whitespace-nowrap p-2 font-bold">{md.year_name}</td>
                                                {Array.from({ length: 12 }, (_, mi) => {
                                                    const c = md.months[mi + 1] || 0;
                                                    return <td key={mi} className="p-1.5 text-center tnum">{c > 0 ? c : <span className="text-muted-foreground/40">-</span>}</td>;
                                                })}
                                                <td className="text-primary p-2 text-center font-bold tnum">{total}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {/* 7. نشاط الموجّهين */}
                {visitorStats.length > 0 && (
                    <Card>
                        <CardContent className="space-y-4 p-5">
                            <h2 className="text-primary text-lg font-bold">نشاط الموجّهين (الزوّار) عبر الأعوام</h2>
                            {visitorStats.map((vs, idx) => (
                                <div key={vs.year_id}>
                                    <h3 className={cn('mb-2 inline-block rounded-lg px-3 py-1.5 text-sm font-bold text-white', YEAR_BAR[idx % YEAR_BAR.length])}>{vs.year_name}</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-muted/50">
                                                    <th className="p-2 text-right">#</th>
                                                    <th className="p-2 text-right">الموجّه</th>
                                                    <th className="p-2 text-center">عدد الزيارات</th>
                                                    <th className="p-2 text-center">متوسط التقييم</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {vs.visitors.map((v, vi) => (
                                                    <tr key={vi} className={cn('border-b border-border/40', vi % 2 && 'bg-muted/20')}>
                                                        <td className="text-muted-foreground p-2 tnum">{vi + 1}</td>
                                                        <td className="p-2 font-medium">{v.name}</td>
                                                        <td className="text-primary p-2 text-center font-bold tnum">{v.visits}</td>
                                                        <td className={cn('p-2 text-center font-bold tnum', tone(v.avg))}>{v.avg != null ? `${v.avg}%` : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}

function Mini({ value, label, tone: t, accent }: { value: string; label: string; tone?: string; accent?: boolean }) {
    return (
        <div className="text-center">
            <div className={cn('text-xl font-bold tnum', accent && 'text-primary', t)}>{value}</div>
            <div className="text-muted-foreground text-xs">{label}</div>
        </div>
    );
}

function DistCell({ n, total, className }: { n: number; total: number; className: string }) {
    return (
        <td className="p-2 text-center">
            <span className={cn('font-bold tnum', className)}>{n}</span>
            <span className="text-muted-foreground mr-1 text-[10px] tnum">({total > 0 ? Math.round((n / total) * 100) : 0}%)</span>
        </td>
    );
}

function HighlightRow({ up = false, name, avg }: { up?: boolean; name: string; avg: number }) {
    return (
        <div className={cn('flex items-center gap-2 rounded-lg p-2', up ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30')}>
            {up ? <TrendingUp className="size-4 shrink-0 text-green-600" /> : <TrendingDown className="size-4 shrink-0 text-red-600" />}
            <div className="min-w-0 flex-1">
                <div className={cn('text-xs font-bold', up ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>{up ? 'الأعلى أداءً' : 'الأدنى أداءً'}</div>
                <div className="truncate text-sm font-medium">{name}</div>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-sm font-bold tnum', bgTone(avg))}>{avg}%</span>
        </div>
    );
}
