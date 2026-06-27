import { navigate, ReportHeader, ReportSelect } from '@/components/visits/report-bits';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Filter, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Dept { id: number; name: string }
interface DomainData { recommendations: string[]; followup_status: string }
interface VisitRow {
    id: number;
    visit_date: string | null;
    visitor: string | null;
    visitor_role: string | null;
    overall_rating: number | null;
    domains: Record<number, DomainData>;
    general_notes: string | null;
}
interface ReportData {
    teacher_name: string;
    subject_name: string | null;
    domains: { id: number; name: string }[];
    visits: VisitRow[];
}
interface PageProps {
    data: ReportData | null;
    followupStatuses: Record<string, string>;
    academicYear: string | null;
    departments: Dept[];
    selectedDepartmentId: number | null;
    teachers: Dept[];
    selectedTeacherId: number | null;
    canEdit: boolean;
}

const STATUS_COLOR: Record<string, string> = {
    pending: 'border-border bg-muted text-muted-foreground',
    full: 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
    mostly: 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    partially: 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    not_done: 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};
const STATUS_DOT: Record<string, string> = {
    pending: 'bg-muted-foreground/40', full: 'bg-green-500', mostly: 'bg-blue-500', partially: 'bg-amber-500', not_done: 'bg-red-500',
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'الزيارات', href: '/visits' },
    { title: 'متابعة التوصيات', href: '/supervision-reports/recommendations' },
];

export default function RecommendationsFollowup({ data, followupStatuses, academicYear, departments, selectedDepartmentId, teachers, selectedTeacherId, canEdit }: PageProps) {
    const deptId = selectedDepartmentId ? String(selectedDepartmentId) : '';
    const teacherId = selectedTeacherId ? String(selectedTeacherId) : '';
    const [saving, setSaving] = useState<Record<string, boolean>>({});

    const changeStatus = (visitId: number, domainId: number, status: string) => {
        const key = `${visitId}-${domainId}`;
        setSaving((p) => ({ ...p, [key]: true }));
        router.post('/supervision-reports/followup', { visit_id: visitId, domain_id: domainId, status }, {
            preserveScroll: true,
            preserveState: false,
            onFinish: () => setSaving((p) => ({ ...p, [key]: false })),
            onSuccess: () => toast.success('تم تحديث حالة المتابعة'),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="متابعة التوصيات" />
            <div className="flex flex-col gap-4 p-4 md:p-6">
                <ReportHeader
                    title="متابعة تنفيذ التوصيات المقدّمة للمعلمين"
                    subtitle={`للعام الأكاديمي ${academicYear ?? ''}`}
                    printUrl={teacherId ? `/supervision-reports/print?type=recommendations&teacher_id=${teacherId}` : undefined}
                />

                <Card>
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <span className="text-primary flex items-center gap-1.5 font-bold"><Filter className="size-4" /> القسم:</span>
                        <ReportSelect value={deptId} placeholder="اختر القسم" options={departments.map((d) => ({ value: String(d.id), label: d.name }))} onChange={(v) => navigate('/supervision-reports/recommendations', { department_id: v })} />
                        {deptId && (
                            <>
                                <span className="text-primary flex items-center gap-1.5 font-bold"><User className="size-4" /> المعلم:</span>
                                <ReportSelect value={teacherId} placeholder="اختر المعلم" options={teachers.map((t) => ({ value: String(t.id), label: t.name }))} onChange={(v) => navigate('/supervision-reports/recommendations', { department_id: deptId, teacher_id: v })} />
                            </>
                        )}
                    </CardContent>
                </Card>

                {!data ? (
                    <Card><CardContent className="text-muted-foreground p-10 text-center">{deptId ? 'اختر معلماً لعرض توصياته' : 'اختر قسماً ثم معلماً'}</CardContent></Card>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-lg font-bold">{data.teacher_name} <span className="text-muted-foreground text-sm font-normal">— {data.subject_name} · {data.visits.length} زيارة</span></h2>
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                {Object.entries(followupStatuses).map(([k, label]) => (
                                    <span key={k} className="flex items-center gap-1"><span className={cn('size-2.5 rounded-full', STATUS_DOT[k])} />{label}</span>
                                ))}
                            </div>
                        </div>

                        {data.visits.length === 0 && <Card><CardContent className="text-muted-foreground p-8 text-center">لا توجد زيارات لهذا المعلم</CardContent></Card>}

                        {data.visits.map((v, vIdx) => (
                            <Card key={v.id} className="overflow-hidden p-0">
                                <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-bold">{vIdx + 1}</span>
                                        <div>
                                            <div className="font-bold">الزيارة {vIdx + 1} <span className="text-muted-foreground text-xs font-normal">{v.visit_date}</span></div>
                                            <div className="text-muted-foreground text-xs">{v.visitor_role}: {v.visitor}</div>
                                        </div>
                                    </div>
                                    {v.overall_rating != null && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary tnum">{v.overall_rating}%</span>}
                                </div>
                                <div className="divide-y divide-border/60">
                                    {data.domains.map((d) => {
                                        const dd = v.domains[d.id];
                                        const status = dd?.followup_status ?? 'pending';
                                        const key = `${v.id}-${d.id}`;
                                        return (
                                            <div key={d.id} className="flex items-start gap-4 px-4 py-3">
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="mb-1.5 flex items-center gap-2 text-sm font-bold"><span className={cn('size-2 rounded-full', STATUS_DOT[status])} />{d.name}</h4>
                                                    {dd?.recommendations.length ? (
                                                        <ul className="mr-4 space-y-1 text-sm text-muted-foreground">
                                                            {dd.recommendations.map((rec, ri) => (
                                                                <li key={ri} className="flex items-start gap-2"><span className="text-primary">-</span><span>{rec}</span></li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="mr-4 text-xs text-muted-foreground/60">لا توجد توصيات</p>
                                                    )}
                                                </div>
                                                <div className="w-44 shrink-0">
                                                    {canEdit ? (
                                                        <select
                                                            value={status}
                                                            onChange={(e) => changeStatus(v.id, d.id, e.target.value)}
                                                            disabled={saving[key]}
                                                            className={cn('w-full rounded-lg border px-2 py-1.5 text-xs', STATUS_COLOR[status], saving[key] && 'opacity-50')}
                                                        >
                                                            {Object.entries(followupStatuses).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                                                        </select>
                                                    ) : (
                                                        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', STATUS_COLOR[status])}>
                                                            <span className={cn('size-2 rounded-full', STATUS_DOT[status])} />{followupStatuses[status] ?? status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {v.general_notes && (
                                        <div className="bg-amber-50/50 px-4 py-3 dark:bg-amber-950/20">
                                            <h4 className="mb-1 text-xs font-bold text-amber-800 dark:text-amber-300">ملاحظات وتوصيات عامة:</h4>
                                            <p className="text-sm text-amber-900 dark:text-amber-200">{v.general_notes}</p>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
