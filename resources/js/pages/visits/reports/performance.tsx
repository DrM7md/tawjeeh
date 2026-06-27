import { Improvement, navigate, Pct, ReportHeader, ReportSelect } from '@/components/visits/report-bits';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Filter, User } from 'lucide-react';
import { Fragment } from 'react';

interface Dept { id: number; name: string }
interface VisitRow {
    id: number;
    date: string | null;
    year: string | null;
    visitor: string | null;
    domain_ratings: Record<number, number | null>;
    overall: number | null;
}
interface Report {
    teacher_name: string;
    subject_name: string | null;
    visit_count: number;
    date_range: { from: string | null; to: string | null };
    domains: { id: number; name: string }[];
    visits: VisitRow[];
    domain_averages: Record<number, number | null>;
    overall_average: number | null;
    improvement_domains: Record<number, number | null>;
    improvement_overall: number | null;
}
interface PageProps {
    departments: Dept[];
    selectedDepartmentId: number | null;
    teachers: Dept[];
    selectedTeacherId: number | null;
    report: Report | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'الزيارات', href: '/visits' },
    { title: 'أداء معلم', href: '/supervision-reports/performance' },
];

export default function PerformanceReport({ departments, selectedDepartmentId, teachers, selectedTeacherId, report }: PageProps) {
    const deptId = selectedDepartmentId ? String(selectedDepartmentId) : '';
    const teacherId = selectedTeacherId ? String(selectedTeacherId) : '';
    const printUrl = teacherId ? `/supervision-reports/print?type=performance&teacher_id=${teacherId}` : undefined;

    const improvementBetween = (idx: number, domainId: number | 'overall'): number | null => {
        if (!report || idx < 1) return null;
        const prev = domainId === 'overall' ? report.visits[idx - 1].overall : report.visits[idx - 1].domain_ratings[domainId];
        const curr = domainId === 'overall' ? report.visits[idx].overall : report.visits[idx].domain_ratings[domainId];
        if (prev == null || curr == null) return null;
        return Math.round((curr - prev) * 10) / 10;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="تقرير أداء المعلم" />
            <div className="flex flex-col gap-4 p-4 md:p-6">
                <ReportHeader title="تقرير أداء المعلم عبر الزيارات" subtitle="مقارنة أداء المعلم في جميع زياراته الصفية عبر الأعوام" printUrl={printUrl} />

                <Card>
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <span className="text-primary flex items-center gap-1.5 font-bold"><Filter className="size-4" /> القسم:</span>
                        <ReportSelect
                            value={deptId}
                            placeholder="اختر القسم"
                            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
                            onChange={(v) => navigate('/supervision-reports/performance', { department_id: v })}
                        />
                        {deptId && (
                            <>
                                <span className="text-primary flex items-center gap-1.5 font-bold"><User className="size-4" /> المعلم:</span>
                                <ReportSelect
                                    value={teacherId}
                                    placeholder="اختر المعلم"
                                    options={teachers.map((t) => ({ value: String(t.id), label: t.name }))}
                                    onChange={(v) => navigate('/supervision-reports/performance', { department_id: deptId, teacher_id: v })}
                                />
                            </>
                        )}
                    </CardContent>
                </Card>

                {!report ? (
                    <Card><CardContent className="text-muted-foreground p-10 text-center">{deptId ? 'اختر معلماً لعرض التقرير' : 'اختر قسماً ثم معلماً'}</CardContent></Card>
                ) : report.domains.length === 0 || report.visits.length === 0 ? (
                    <Card><CardContent className="text-muted-foreground p-10 text-center">لا توجد زيارات/قالب لهذا المعلم</CardContent></Card>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-lg font-bold">{report.teacher_name} <span className="text-muted-foreground text-sm font-normal">— {report.subject_name}</span></h2>
                            <span className="text-muted-foreground text-sm">{report.visit_count} زيارة · {report.date_range.from} ← {report.date_range.to}</span>
                        </div>
                        <Card>
                            <CardContent className="overflow-x-auto p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-primary text-primary-foreground">
                                            <th className="p-3 text-right">البيان</th>
                                            {report.domains.map((d) => <th key={d.id} className="p-3 text-center text-xs">{d.name}</th>)}
                                            <th className="p-3 text-center">الأداء العام</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.visits.map((v, idx) => (
                                            <Fragment key={v.id}>
                                                <tr className={cn('border-b border-border/40', idx % 2 && 'bg-muted/20')}>
                                                    <td className="p-2.5">
                                                        <div className="font-medium">الزيارة {idx + 1}</div>
                                                        <div className="text-muted-foreground text-[11px]">{v.year} · {v.visitor}</div>
                                                    </td>
                                                    {report.domains.map((d) => <td key={d.id} className="p-2.5 text-center"><Pct v={v.domain_ratings[d.id]} /></td>)}
                                                    <td className="p-2.5 text-center"><Pct v={v.overall} /></td>
                                                </tr>
                                                {idx > 0 && (
                                                    <tr className="border-b border-border/40 bg-amber-50/60 dark:bg-amber-950/20">
                                                        <td className="p-2 text-right text-[11px] font-medium text-amber-800 dark:text-amber-300">نسبة التحسّن/التراجع</td>
                                                        {report.domains.map((d) => <td key={d.id} className="p-2 text-center"><Improvement v={improvementBetween(idx, d.id)} /></td>)}
                                                        <td className="p-2 text-center"><Improvement v={improvementBetween(idx, 'overall')} /></td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-50 font-bold dark:bg-blue-950/40">
                                            <td className="p-3 text-blue-700 dark:text-blue-300">معدّل الأداء</td>
                                            {report.domains.map((d) => <td key={d.id} className="p-3 text-center"><Pct v={report.domain_averages[d.id]} /></td>)}
                                            <td className="p-3 text-center"><Pct v={report.overall_average} /></td>
                                        </tr>
                                        <tr className="bg-amber-50 dark:bg-amber-950/30">
                                            <td className="p-3 text-amber-800 dark:text-amber-300">النسبة العامة للتحسّن/التراجع</td>
                                            {report.domains.map((d) => <td key={d.id} className="p-3 text-center"><Improvement v={report.improvement_domains[d.id]} /></td>)}
                                            <td className="p-3 text-center"><Improvement v={report.improvement_overall} /></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
