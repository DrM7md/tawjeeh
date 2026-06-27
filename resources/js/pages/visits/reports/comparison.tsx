import { navigate, Pct, ReportHeader, ReportSelect } from '@/components/visits/report-bits';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Filter } from 'lucide-react';

interface Dept { id: number; name: string }
interface Teacher {
    id: number;
    name: string;
    visit_count: number;
    visitors: string[];
    domain_ratings: Record<number, number | null>;
    overall: number | null;
}
interface Report {
    subject_name: string | null;
    domains: { id: number; name: string }[];
    teachers: Teacher[];
    domain_averages: Record<number, number | null>;
    overall_average: number | null;
    best: Record<number, string | null>;
    worst: Record<number, string | null>;
    visit_count: number;
    academicYear: string | null;
}
interface PageProps {
    departments: Dept[];
    selectedDepartmentId: number | null;
    report: Report | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'الزيارات', href: '/visits' },
    { title: 'مقارنة المعلمين', href: '/supervision-reports/comparison' },
];

export default function ComparisonReport({ departments, selectedDepartmentId, report }: PageProps) {
    const deptId = selectedDepartmentId ? String(selectedDepartmentId) : '';
    const printUrl = deptId ? `/supervision-reports/print?type=comparison&department_id=${deptId}` : undefined;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="مقارنة أداء المعلمين" />
            <div className="flex flex-col gap-4 p-4 md:p-6">
                <ReportHeader title="تقرير مقارنة أداء المعلمين" subtitle={`للعام الأكاديمي ${report?.academicYear ?? ''}`} printUrl={printUrl} />

                <Card>
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <span className="text-primary flex items-center gap-1.5 font-bold"><Filter className="size-4" /> القسم:</span>
                        <ReportSelect
                            value={deptId}
                            placeholder="اختر القسم"
                            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
                            onChange={(v) => navigate('/supervision-reports/comparison', { department_id: v })}
                        />
                    </CardContent>
                </Card>

                {!report || report.domains.length === 0 ? (
                    <Card><CardContent className="text-muted-foreground p-10 text-center">لا يوجد قالب أو بيانات لهذا القسم</CardContent></Card>
                ) : (
                    <>
                        <h2 className="text-lg font-bold">{report.subject_name} <span className="text-muted-foreground text-sm font-normal">— {report.visit_count} زيارة</span></h2>
                        <Card>
                            <CardContent className="overflow-x-auto p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-primary text-primary-foreground">
                                            <th className="p-3 text-right">المعلم</th>
                                            <th className="p-3 text-right">الزائر</th>
                                            <th className="p-3 text-center">الزيارات</th>
                                            {report.domains.map((d) => <th key={d.id} className="p-3 text-center text-xs">{d.name}</th>)}
                                            <th className="p-3 text-center">الأداء العام</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.teachers.map((t, i) => (
                                            <tr key={t.id} className={cn('border-b border-border/40', i % 2 && 'bg-muted/20')}>
                                                <td className="p-2.5 font-medium">{t.name}</td>
                                                <td className="text-muted-foreground p-2.5 text-xs">{t.visitors.join('، ') || '—'}</td>
                                                <td className="p-2.5 text-center tnum">{t.visit_count}</td>
                                                {report.domains.map((d) => <td key={d.id} className="p-2.5 text-center"><Pct v={t.domain_ratings[d.id]} /></td>)}
                                                <td className="p-2.5 text-center"><Pct v={t.overall} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-50 font-bold dark:bg-blue-950/40">
                                            <td className="p-3 text-blue-700 dark:text-blue-300" colSpan={3}>معدّل الأداء في القسم</td>
                                            {report.domains.map((d) => <td key={d.id} className="p-3 text-center"><Pct v={report.domain_averages[d.id]} /></td>)}
                                            <td className="p-3 text-center"><Pct v={report.overall_average} /></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </CardContent>
                        </Card>

                        {/* أفضل / أدنى لكل مجال */}
                        <Card>
                            <CardContent className="overflow-x-auto p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted text-foreground">
                                            <th className="p-3 text-right">جوانب المقارنة</th>
                                            <th className="p-3 text-center text-green-700">أفضل أداء</th>
                                            <th className="p-3 text-center text-red-600">أدنى أداء</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.domains.map((d) => (
                                            <tr key={d.id} className="border-b border-border/40">
                                                <td className="p-2.5 font-medium">{d.name}</td>
                                                <td className="p-2.5 text-center font-medium text-green-700">{report.best[d.id] ?? '—'}</td>
                                                <td className="p-2.5 text-center font-medium text-red-600">{report.worst[d.id] ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
