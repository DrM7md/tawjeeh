import {
    aggregate,
    BoardCard,
    DrilldownBack,
    GenderTabs,
    supervisorInGenderTab,
    type GenderTab,
    type Stats,
    type SupervisorGender,
} from '@/components/shared/drilldown-cards';
import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Building2, CheckCircle2, ClipboardCheck, Clock, ClipboardList, ShieldCheck, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface Rule {
    id: number;
    name: string;
    color: string | null;
    min_percent: number | null;
    max_percent: number | null;
    required_visits: number;
    required_forms: number;
    is_default_for_new: boolean;
}

interface Row {
    teacher_id: number;
    name: string;
    school: string | null;
    department: string | null;
    classification: string | null;
    classification_color: string | null;
    required_visits: number;
    done_visits: number;
    required_forms: number;
    done_forms: number;
    status: 'complete' | 'remaining' | 'late';
    record_id: number | null;
    stage: string | null;
    record_status: 'draft' | 'approved' | null;
    score: number | null;
    is_new: boolean;
}

interface NamedRef {
    id: number;
    name: string;
}
interface DeptBoard extends Stats {
    id: number;
    name: string;
}
interface SupBoard extends Stats {
    id: number;
    name: string;
    gender: SupervisorGender;
    schools: number;
}

interface DashboardData {
    rows: Row[];
    stats: { total: number; complete: number; remaining: number; late: number; completion: number };
}

interface PageProps {
    view: 'departments' | 'supervisors' | 'dashboard';
    // مستوى الأقسام
    departments?: DeptBoard[];
    // مستوى الموجهين
    department?: NamedRef | null;
    supervisors?: SupBoard[];
    canDrillDepartments?: boolean;
    // مستوى اللوحة
    dashboard?: DashboardData;
    rules?: Rule[];
    can?: { classify: boolean; approve: boolean };
    supervisor?: NamedRef | null;
    canDrillSupervisors?: boolean;
}

const STAGES = [
    { value: 'initial', label: 'مبدئي (أول 3 أسابيع)' },
    { value: 'midyear', label: 'منتصف (نهاية الفصل الأول)' },
    { value: 'final', label: 'نهائي (نهاية العام)' },
];

const BASES = [
    { value: 'supervisor_observation', label: 'ملاحظة الموجه (من الزيارات)' },
    { value: 'annual_eval', label: 'التقييم السنوي' },
];

const statusMeta: Record<Row['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    complete: { label: 'مكتمل', variant: 'default' },
    remaining: { label: 'متبقٍّ', variant: 'secondary' },
    late: { label: 'متأخر', variant: 'destructive' },
};

const normalizeColor = (raw: string | null): string | undefined => (raw ? (raw.startsWith('#') ? raw : `#${raw}`) : undefined);

const ratio = (done: number, required: number) => {
    const ok = done >= required;
    return (
        <span className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
            {done} / {required}
        </span>
    );
};

/** إجمالي إحصاءات بطاقات (للبطاقات العلوية في مستويَي الأقسام/الموجهين). */
function BoardStatRow({ items }: Readonly<{ items: Stats[] }>) {
    const totals = aggregate(items);
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="نسبة الالتزام الكلية" value={`${totals.completion}%`} icon={ClipboardList} tone="primary" hint={`${totals.total} معلم`} />
            <StatCard title="مكتمل" value={totals.done} icon={CheckCircle2} tone="success" />
            <StatCard title="متبقٍّ" value={totals.remaining} icon={Clock} tone="warning" />
            <StatCard title="متأخر" value={totals.late} icon={AlertTriangle} tone="destructive" />
        </div>
    );
}

/* ===================== المستوى الأخير: لوحة التصنيف والالتزام ===================== */
function DashboardLevel({ dashboard, rules, can, supervisor, department, canDrillSupervisors }: Readonly<Required<Pick<PageProps, 'dashboard' | 'rules' | 'can'>> & Pick<PageProps, 'supervisor' | 'department' | 'canDrillSupervisors'>>) {
    const { rows, stats } = dashboard;
    const [target, setTarget] = useState<Row | null>(null);
    const [processing, setProcessing] = useState(false);
    const [form, setForm] = useState({ stage: 'initial', basis: 'supervisor_observation', score: '', is_new: false, note: '' });

    const backHref = department ? `/classification?department=${department.id}` : '/classification';
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'التصنيف ومتطلبات المتابعة', href: '/classification' },
        ...(supervisor ? [{ title: supervisor.name, href: '#' }] : []),
    ];

    const openClassify = (row: Row) => {
        setForm({ stage: 'initial', basis: 'supervisor_observation', score: row.score != null ? String(row.score) : '', is_new: row.is_new, note: '' });
        setTarget(row);
    };

    // معاينة الفئة الآلية وفق الدرجة المُدخلة + قواعد التصنيف
    const previewRule = useMemo<Rule | null>(() => {
        if (form.is_new || form.score === '') return rules.find((r) => r.is_default_for_new) ?? null;
        const pct = Number(form.score);
        if (Number.isNaN(pct)) return null;
        return rules.find((r) => pct >= (r.min_percent ?? 0) && pct <= (r.max_percent ?? 100)) ?? null;
    }, [form.is_new, form.score, rules]);

    const submitClassify = (e: React.FormEvent) => {
        e.preventDefault();
        if (!target) return;
        setProcessing(true);
        router.post(
            '/classification/classify',
            {
                teacher_id: target.teacher_id,
                stage: form.stage,
                basis: form.basis,
                score: form.score === '' ? null : Number(form.score),
                is_new: form.is_new,
                note: form.note,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('تم حفظ التصنيف');
                    setTarget(null);
                },
                onError: () => toast.error('تعذّر حفظ التصنيف'),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const approve = (row: Row) => {
        if (!row.record_id) return;
        router.post(`/classification/records/${row.record_id}/approve`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success('تم اعتماد التصنيف'),
            onError: () => toast.error('تعذّر الاعتماد'),
        });
    };

    const columns: ColumnDef<Row>[] = [
        { accessorKey: 'name', header: 'المعلم', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { id: 'school', header: 'المدرسة', cell: ({ row }) => row.original.school ?? '—' },
        {
            id: 'classification',
            header: 'الفئة',
            cell: ({ row }) => {
                const c = normalizeColor(row.original.classification_color);
                return row.original.classification ? (
                    <Badge variant="outline" style={c ? { borderColor: c, color: c } : undefined}>
                        {row.original.classification}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground">غير مصنّف</span>
                );
            },
        },
        { id: 'visits', header: 'الزيارات', cell: ({ row }) => ratio(row.original.done_visits, row.original.required_visits) },
        { id: 'forms', header: 'الاستمارات', cell: ({ row }) => ratio(row.original.done_forms, row.original.required_forms) },
        { id: 'status', header: 'الالتزام', cell: ({ row }) => <Badge variant={statusMeta[row.original.status].variant}>{statusMeta[row.original.status].label}</Badge> },
        {
            id: 'record',
            header: 'التصنيف',
            cell: ({ row }) =>
                row.original.record_status ? (
                    <Badge variant={row.original.record_status === 'approved' ? 'default' : 'secondary'}>
                        {row.original.record_status === 'approved' ? 'معتمَد' : 'بانتظار الاعتماد'}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    {can.approve && row.original.record_id && row.original.record_status === 'draft' && (
                        <Button variant="ghost" size="sm" onClick={() => approve(row.original)}>
                            <CheckCircle2 className="size-4" /> اعتماد
                        </Button>
                    )}
                    {can.classify && (
                        <Button variant="outline" size="sm" onClick={() => openClassify(row.original)}>
                            تصنيف
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    const filters: DataTableFilter<Row>[] = [
        {
            id: 'status',
            label: 'الالتزام',
            variant: 'tabs',
            options: [
                { value: 'complete', label: 'مكتمل' },
                { value: 'remaining', label: 'متبقٍّ' },
                { value: 'late', label: 'متأخر' },
            ],
            getValue: (r) => r.status,
        },
        {
            id: 'classification',
            label: 'الفئة',
            options: rules.map((r) => ({ value: r.name, label: r.name })),
            getValue: (r) => r.classification ?? '',
        },
    ];

    const title = supervisor ? `التصنيف — ${supervisor.name}` : 'التصنيف ومتطلبات المتابعة';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={title} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {supervisor && canDrillSupervisors && <DrilldownBack href={backHref} label="رجوع إلى الموجهين" />}
                <PageHeader title={title} description="إدخال التقدير ← فئة آلية ← متطلبات الزيارات والاستمارات ← متابعة الالتزام" />

                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Card className="p-4"><div className="text-muted-foreground text-xs">الإجمالي</div><div className="text-2xl font-bold">{stats.total}</div></Card>
                    <Card className="p-4"><div className="text-muted-foreground text-xs">مكتمل</div><div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.complete}</div></Card>
                    <Card className="p-4"><div className="text-muted-foreground text-xs">متبقٍّ</div><div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.remaining}</div></Card>
                    <Card className="p-4"><div className="text-muted-foreground text-xs">متأخر</div><div className="text-2xl font-bold text-destructive">{stats.late}</div></Card>
                    <Card className="p-4"><div className="text-muted-foreground text-xs">نسبة الالتزام</div><div className="text-2xl font-bold">{stats.completion}%</div></Card>
                </div>

                <Card className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="size-4 text-primary" /> قواعد التصنيف (قابلة للتعديل من الإعدادات)
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {rules.map((r) => {
                            const c = normalizeColor(r.color);
                            const band = r.min_percent != null && r.max_percent != null ? `${r.min_percent}–${r.max_percent}%` : '—';
                            return (
                                <div key={r.id} className="rounded-lg border border-border/60 px-3 py-2 text-xs">
                                    <span className="font-semibold" style={c ? { color: c } : undefined}>{r.name}</span>
                                    {r.is_default_for_new && <span className="text-muted-foreground"> (الجديد)</span>}
                                    <div className="text-muted-foreground mt-0.5">
                                        {band} · {r.required_visits} زيارة · {r.required_forms} استمارة
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <DataTable
                    columns={columns}
                    data={rows}
                    searchPlaceholder="ابحث عن معلم..."
                    storageKey="view:classification"
                    filters={filters}
                    emptyMessage="لا يوجد معلمون ضمن نطاقك"
                />
            </div>

            <FormDialog
                open={!!target}
                onOpenChange={(o) => !o && setTarget(null)}
                title={`تصنيف: ${target?.name ?? ''}`}
                description="حدّد المرحلة والأساس وأدخل التقدير — تُحدَّد الفئة ومتطلباتها آليًا."
                onSubmit={submitClassify}
                loading={processing}
                submitLabel={can.approve ? 'تصنيف واعتماد' : 'حفظ التصنيف'}
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label>المرحلة</Label>
                        <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>أساس التصنيف</Label>
                        <Select value={form.basis} onValueChange={(v) => setForm((f) => ({ ...f, basis: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {BASES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="score">التقدير (%)</Label>
                        <input
                            id="score"
                            type="number"
                            min={0}
                            max={100}
                            value={form.score}
                            onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                            disabled={form.is_new}
                            placeholder={form.basis === 'supervisor_observation' ? 'اتركه فارغًا لاستخدام آخر زيارة' : 'مثال: 88'}
                            className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:opacity-50"
                        />
                    </div>
                    <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.is_new} onChange={(e) => setForm((f) => ({ ...f, is_new: e.target.checked }))} />
                            معلم جديد (دعم مكثف آليًا)
                        </label>
                    </div>
                </FormSection>

                <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3 text-sm">
                    <ClipboardCheck className="size-4 text-primary" />
                    {previewRule ? (
                        <span>
                            الفئة الآلية: <strong style={{ color: normalizeColor(previewRule.color) }}>{previewRule.name}</strong> — تتطلب{' '}
                            {previewRule.required_visits} زيارة و{previewRule.required_forms} استمارة لكل فصل.
                        </span>
                    ) : (
                        <span className="text-muted-foreground">أدخل تقديرًا لعرض الفئة الآلية.</span>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="note">ملاحظة (اختياري)</Label>
                    <input
                        id="note"
                        value={form.note}
                        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                        className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                    />
                </div>
            </FormDialog>
        </AppLayout>
    );
}

/* ===================== التبديل بين المستويات ===================== */
export default function ClassificationIndex(props: PageProps) {
    const [genderTab, setGenderTab] = useState<GenderTab>('all');

    /* مستوى الأقسام */
    if (props.view === 'departments') {
        const departments = props.departments ?? [];
        const breadcrumbs: BreadcrumbItem[] = [
            { title: 'لوحة التحكم', href: '/dashboard' },
            { title: 'التصنيف ومتطلبات المتابعة', href: '/classification' },
        ];
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="التصنيف — الأقسام" />
                <div className="flex flex-col gap-6 p-4 md:p-6">
                    <PageHeader title="التصنيف ومتطلبات المتابعة" description="اختر القسم لعرض موجّهيه ونِسب التزامهم" />
                    <BoardStatRow items={departments} />
                    {departments.length === 0 ? (
                        <Card className="text-muted-foreground p-8 text-center">لا توجد أقسام</Card>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {departments.map((d) => (
                                <BoardCard key={d.id} href={`/classification?department=${d.id}`} name={d.name} icon={Building2} stats={d} />
                            ))}
                        </div>
                    )}
                </div>
            </AppLayout>
        );
    }

    /* مستوى الموجهين */
    if (props.view === 'supervisors') {
        const supervisors = props.supervisors ?? [];
        const department = props.department ?? null;
        const visible = supervisors.filter((s) => supervisorInGenderTab(s.gender, genderTab));
        const breadcrumbs: BreadcrumbItem[] = [
            { title: 'لوحة التحكم', href: '/dashboard' },
            { title: 'التصنيف ومتطلبات المتابعة', href: '/classification' },
            { title: department?.name ?? 'القسم', href: '#' },
        ];
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`التصنيف — ${department?.name ?? 'الموجهون'}`} />
                <div className="flex flex-col gap-6 p-4 md:p-6">
                    {props.canDrillDepartments && <DrilldownBack href="/classification" label="رجوع إلى الأقسام" />}
                    <PageHeader title={department?.name ?? 'الموجهون'} description="اختر الموجّه لعرض لوحة تصنيفه والتزام معلميه" />
                    <BoardStatRow items={supervisors} />
                    <GenderTabs value={genderTab} onChange={setGenderTab} />
                    {visible.length === 0 ? (
                        <Card className="text-muted-foreground p-8 text-center">
                            {supervisors.length === 0 ? 'لا يوجد موجّهون في هذا القسم' : 'لا يوجد موجّهون مطابقون لهذا التبويب'}
                        </Card>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visible.map((s) => (
                                <BoardCard
                                    key={s.id}
                                    href={`/classification?supervisor=${s.id}`}
                                    name={s.name}
                                    icon={UserRound}
                                    gender={s.gender}
                                    subtitle={`${s.schools} مدرسة`}
                                    stats={s}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </AppLayout>
        );
    }

    /* مستوى اللوحة */
    return (
        <DashboardLevel
            dashboard={props.dashboard!}
            rules={props.rules ?? []}
            can={props.can ?? { classify: false, approve: false }}
            supervisor={props.supervisor}
            department={props.department}
            canDrillSupervisors={props.canDrillSupervisors}
        />
    );
}
