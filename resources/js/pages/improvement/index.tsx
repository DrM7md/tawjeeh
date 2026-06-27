import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
import {
    DepartmentsLevel,
    DrilldownBack,
    SupervisorsLevel,
    type DeptBoardItem,
    type SupBoardItem,
} from '@/components/shared/drilldown-cards';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, CheckCircle2, ListChecks, Plus, Target, Trash2, TrendingUp, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';


const STATUS_LABELS: Record<string, string> = { active: 'نشطة', completed: 'مكتملة', cancelled: 'ملغاة' };
/** عدد الأيام قبل اعتبار المراجعة الشهرية متأخّرة (يطابق أمر التذكير الآلي). */
const REVIEW_DUE_DAYS = 30;

interface Opt {
    id: number;
    name: string;
}
interface SchoolOpt extends Opt {
    stage_id: number | null;
    stage?: { id: number; name: string } | null;
}
interface TeacherOpt extends Opt {
    school_id: number;
    department_id: number | null;
}
interface Plan {
    id: number;
    title: string | null;
    goals: string[] | null;
    status: 'active' | 'completed' | 'cancelled';
    start_date: string | null;
    target_date: string | null;
    reviews_count: number;
    reviews_max_review_date: string | null;
    target?: Opt | null;
    school?: Opt | null;
    department?: Opt | null;
    supervisor?: Opt | null;
}
interface SelfPlan {
    id: number;
    goals: string[] | null;
    supervisor_feedback: string | null;
    status: 'active' | 'completed' | 'cancelled';
    target?: Opt | null;
    school?: Opt | null;
    department?: Opt | null;
}
interface ContentProps {
    plans: Plan[];
    selfPlans: SelfPlan[];
    schools: SchoolOpt[];
    teachers: TeacherOpt[];
    userDepartment: Opt | null;
    departments: Opt[];
    canCreate: boolean;
    canEdit: boolean;
    supervisor?: Opt | null;
    contextDepartment?: Opt | null;
    canDrillSupervisors?: boolean;
}
interface PageProps {
    view: 'departments' | 'supervisors' | 'content';
    // مستوى الأقسام
    departmentCards?: DeptBoardItem[];
    // مستوى الموجهين
    supervisors?: SupBoardItem[];
    contextDepartment?: Opt | null;
    canDrillDepartments?: boolean;
    // مستوى المحتوى
    plans?: Plan[];
    selfPlans?: SelfPlan[];
    schools?: SchoolOpt[];
    teachers?: TeacherOpt[];
    userDepartment?: Opt | null;
    departments?: Opt[];
    canCreate?: boolean;
    canEdit?: boolean;
    supervisor?: Opt | null;
    canDrillSupervisors?: boolean;
}

/** هل تأخّرت المراجعة الشهرية لخطة نشطة؟ (مرجع: آخر مراجعة، وإلا بداية الخطة). */
function isReviewOverdue(plan: Plan): boolean {
    if (plan.status !== 'active') return false;
    const ref = plan.reviews_max_review_date ?? plan.start_date;
    if (!ref) return false;
    const days = (Date.now() - new Date(ref).getTime()) / 86_400_000;
    return days >= REVIEW_DUE_DAYS;
}

function ContentLevel({ plans, selfPlans, schools, teachers, userDepartment, departments, canCreate, canEdit, supervisor, contextDepartment, canDrillSupervisors }: Readonly<ContentProps>) {
    const tabFromHash = globalThis.window !== undefined && globalThis.location.hash === '#self' ? 'self' : 'plans';
    const [tab, setTab] = useState<'plans' | 'self'>(tabFromHash);

    const backHref = contextDepartment ? `/improvement?department=${contextDepartment.id}` : '/improvement';
    const crumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'خطط التحسين والتطوير', href: '/improvement' },
        ...(supervisor ? [{ title: supervisor.name, href: '#' }] : []),
    ];
    const pageTitle = supervisor ? `خطط التحسين والتطوير — ${supervisor.name}` : 'خطط التحسين والتطوير الذاتي';

    const [planOpen, setPlanOpen] = useState(false);
    const [selfOpen, setSelfOpen] = useState(false);
    const [editingSelf, setEditingSelf] = useState<SelfPlan | null>(null);
    const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
    const [deletingSelf, setDeletingSelf] = useState<SelfPlan | null>(null);

    const stats = useMemo(
        () => ({
            active: plans.filter((p) => p.status === 'active').length,
            completed: plans.filter((p) => p.status === 'completed').length,
            overdue: plans.filter(isReviewOverdue).length,
        }),
        [plans],
    );

    /* ===================== نموذج خطة التحسين ===================== */
    const planForm = useForm<{
        target_kind: string;
        target_id: string;
        school_id: string;
        department_id: string;
        title: string;
        goals: string[];
        start_date: string;
        target_date: string;
    }>({
        target_kind: 'teacher',
        target_id: '',
        school_id: '',
        department_id: '',
        title: '',
        goals: [''],
        start_date: new Date().toISOString().slice(0, 10),
        target_date: '',
    });

    /* ===================== نموذج التطوير الذاتي ===================== */
    const selfForm = useForm<{
        target_kind: string;
        target_id: string;
        school_id: string;
        department_id: string;
        goals: string[];
        supervisor_feedback: string;
        status: string;
    }>({
        target_kind: 'teacher',
        target_id: '',
        school_id: '',
        department_id: '',
        goals: [''],
        supervisor_feedback: '',
        status: 'active',
    });

    const teachersOf = (schoolId: string) => teachers.filter((t) => String(t.school_id) === schoolId).map((t) => ({ value: String(t.id), label: t.name }));

    const openCreatePlan = () => {
        planForm.clearErrors();
        planForm.reset();
        planForm.setData('start_date', new Date().toISOString().slice(0, 10));
        setPlanOpen(true);
    };
    const submitPlan = (e: React.FormEvent) => {
        e.preventDefault();
        planForm.post('/improvement', { onSuccess: () => setPlanOpen(false) });
    };

    const openCreateSelf = () => {
        selfForm.clearErrors();
        selfForm.reset();
        setEditingSelf(null);
        setSelfOpen(true);
    };
    const openEditSelf = (sp: SelfPlan) => {
        selfForm.clearErrors();
        selfForm.setData({
            target_kind: 'teacher',
            target_id: String(sp.target?.id ?? ''),
            school_id: String(sp.school?.id ?? ''),
            department_id: String(sp.department?.id ?? ''),
            goals: sp.goals?.length ? sp.goals : [''],
            supervisor_feedback: sp.supervisor_feedback ?? '',
            status: sp.status,
        });
        setEditingSelf(sp);
        setSelfOpen(true);
    };
    const submitSelf = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingSelf) {
            selfForm.put(`/improvement-self/${editingSelf.id}`, { onSuccess: () => setSelfOpen(false) });
        } else {
            selfForm.post('/improvement-self', { onSuccess: () => setSelfOpen(false) });
        }
    };

    /* ===================== أعمدة خطط التحسين ===================== */
    const planColumns: ColumnDef<Plan>[] = [
        {
            id: 'target',
            header: 'المستهدف',
            accessorFn: (p) => p.target?.name ?? '',
            cell: ({ row }) => (
                <Link href={`/improvement/${row.original.id}`} className="font-medium hover:underline">
                    {row.original.target?.name ?? '—'}
                </Link>
            ),
        },
        { id: 'school', header: 'المدرسة', cell: ({ row }) => row.original.school?.name ?? '—' },
        { id: 'department', header: 'المادة', cell: ({ row }) => row.original.department?.name ?? '—' },
        {
            id: 'goals',
            header: 'الأهداف',
            cell: ({ row }) => <span className="tnum text-sm">{row.original.goals?.length ?? 0}</span>,
        },
        {
            id: 'reviews',
            header: 'المراجعات',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="tnum text-sm">{row.original.reviews_count}</span>
                    {isReviewOverdue(row.original) && (
                        <Badge variant="outline" className="gap-1 border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            <AlertTriangle className="size-3" /> متأخّرة
                        </Badge>
                    )}
                </div>
            ),
        },
        {
            id: 'status',
            header: 'الحالة',
            accessorFn: (p) => p.status,
            cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{STATUS_LABELS[row.original.status]}</Badge>,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) =>
                canCreate && (
                    <div className="flex justify-end">
                        <button type="button" onClick={() => setDeletingPlan(row.original)} aria-label="حذف">
                            <Trash2 className="text-destructive size-4" />
                        </button>
                    </div>
                ),
        },
    ];

    const planFilters: DataTableFilter<Plan>[] = [
        {
            id: 'status',
            label: 'الحالة',
            variant: 'tabs',
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
            getValue: (p) => p.status,
        },
    ];

    const renderPlanCard = (p: Plan) => {
        const overdue = isReviewOverdue(p);
        return (
            <Card className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <Link href={`/improvement/${p.id}`} className="truncate font-semibold hover:underline">
                            {p.target?.name ?? '—'}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                            {p.school?.name ?? '—'} · {p.department?.name ?? '—'}
                        </p>
                    </div>
                    <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="shrink-0">
                        {STATUS_LABELS[p.status]}
                    </Badge>
                </div>
                {p.title && <p className="text-sm">{p.title}</p>}
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span className="tnum">{p.goals?.length ?? 0} هدف · {p.reviews_count} مراجعة</span>
                    {overdue && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-3" /> مراجعة متأخّرة
                        </span>
                    )}
                </div>
                <Button asChild variant="outline" size="sm" className="mt-auto">
                    <Link href={`/improvement/${p.id}`}>عرض الخطة والمراجعات</Link>
                </Button>
            </Card>
        );
    };

    /* ===================== أعمدة التطوير الذاتي ===================== */
    const selfColumns: ColumnDef<SelfPlan>[] = [
        { id: 'target', header: 'المستهدف', accessorFn: (p) => p.target?.name ?? '', cell: ({ row }) => <span className="font-medium">{row.original.target?.name ?? '—'}</span> },
        { id: 'school', header: 'المدرسة', cell: ({ row }) => row.original.school?.name ?? '—' },
        { id: 'goals', header: 'الأهداف', cell: ({ row }) => <span className="tnum text-sm">{row.original.goals?.length ?? 0}</span> },
        {
            id: 'feedback',
            header: 'تغذية راجعة',
            cell: ({ row }) =>
                row.original.supervisor_feedback ? (
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                ),
        },
        {
            id: 'status',
            header: 'الحالة',
            accessorFn: (p) => p.status,
            cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>{STATUS_LABELS[row.original.status]}</Badge>,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) =>
                canEdit && (
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditSelf(row.original)}>
                            تعديل
                        </Button>
                        {canCreate && (
                            <button type="button" onClick={() => setDeletingSelf(row.original)} aria-label="حذف">
                                <Trash2 className="text-destructive size-4" />
                            </button>
                        )}
                    </div>
                ),
        },
    ];

    return (
        <AppLayout breadcrumbs={crumbs}>
            <Head title={pageTitle} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {supervisor && canDrillSupervisors && <DrilldownBack href={backHref} label="رجوع إلى الموجهين" />}
                <PageHeader
                    title={pageTitle}
                    description="خطط مهيكلة بمراجعات دورية شهرية للدعم المكثف — بدل المتابعات العامة"
                    actions={
                        canCreate &&
                        (tab === 'plans' ? (
                            <Button onClick={openCreatePlan}>
                                <Plus className="size-4" /> خطة تحسين
                            </Button>
                        ) : (
                            <Button onClick={openCreateSelf}>
                                <Plus className="size-4" /> خطة تطوير ذاتي
                            </Button>
                        ))
                    }
                />

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title="خطط نشطة" value={stats.active} icon={Target} tone="primary" />
                    <StatCard title="مكتملة" value={stats.completed} icon={CheckCircle2} tone="success" />
                    <StatCard title="مراجعات متأخّرة" value={stats.overdue} icon={AlertTriangle} tone="warning" />
                </div>

                <ToggleGroup
                    type="single"
                    dir="rtl"
                    value={tab}
                    onValueChange={(v) => v && setTab(v as 'plans' | 'self')}
                    className="justify-start gap-1"
                >
                    <ToggleGroupItem value="plans" className="border-border/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 rounded-lg border px-4">
                        <TrendingUp className="size-4" /> خطط التحسين
                    </ToggleGroupItem>
                    <ToggleGroupItem value="self" className="border-border/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 rounded-lg border px-4">
                        <ListChecks className="size-4" /> التطوير الذاتي
                    </ToggleGroupItem>
                </ToggleGroup>

                {tab === 'plans' ? (
                    <DataTable
                        columns={planColumns}
                        data={plans}
                        searchPlaceholder="ابحث عن مستهدف أو مدرسة..."
                        emptyMessage="لا توجد خطط تحسين بعد"
                        storageKey="view:improvement-plans"
                        filters={planFilters}
                        renderCard={renderPlanCard}
                        defaultView="cards"
                    />
                ) : (
                    <DataTable
                        columns={selfColumns}
                        data={selfPlans}
                        searchPlaceholder="ابحث عن مستهدف أو مدرسة..."
                        emptyMessage="لا توجد خطط تطوير ذاتي بعد"
                        storageKey="view:self-dev-plans"
                        defaultView="table"
                    />
                )}
            </div>

            {/* نموذج خطة تحسين جديدة */}
            <FormDialog open={planOpen} onOpenChange={setPlanOpen} title="خطة تحسين جديدة" onSubmit={submitPlan} loading={planForm.processing} submitLabel="إنشاء ومتابعة">
                <FormSection columns={1}>
                    <TargetFields
                        schools={schools}
                        teachersOf={teachersOf}
                        userDepartment={userDepartment}
                        departments={departments}
                        schoolId={planForm.data.school_id}
                        targetId={planForm.data.target_id}
                        departmentId={planForm.data.department_id}
                        errors={planForm.errors}
                        onSchool={(v) => planForm.setData((d) => ({ ...d, school_id: v, target_id: '' }))}
                        onTarget={(v) => planForm.setData('target_id', v)}
                        onDepartment={(v) => planForm.setData('department_id', v)}
                    />
                    <div className="space-y-2">
                        <Label htmlFor="title">عنوان الخطة (اختياري)</Label>
                        <Input id="title" value={planForm.data.title} onChange={(e) => planForm.setData('title', e.target.value)} placeholder="مثال: تحسين إدارة الصف" />
                    </div>
                    <GoalsEditor value={planForm.data.goals} onChange={(g) => planForm.setData('goals', g)} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="start">تاريخ البدء</Label>
                            <Input id="start" type="date" value={planForm.data.start_date} onChange={(e) => planForm.setData('start_date', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="target">تاريخ مستهدف (اختياري)</Label>
                            <Input id="target" type="date" value={planForm.data.target_date} onChange={(e) => planForm.setData('target_date', e.target.value)} />
                        </div>
                    </div>
                </FormSection>
            </FormDialog>

            {/* نموذج تطوير ذاتي */}
            <FormDialog
                open={selfOpen}
                onOpenChange={setSelfOpen}
                title={editingSelf ? 'تعديل خطة التطوير الذاتي' : 'خطة تطوير ذاتي جديدة'}
                onSubmit={submitSelf}
                loading={selfForm.processing}
                submitLabel={editingSelf ? 'حفظ' : 'إنشاء'}
            >
                <FormSection columns={1}>
                    {!editingSelf && (
                        <TargetFields
                            schools={schools}
                            teachersOf={teachersOf}
                            userDepartment={userDepartment}
                            departments={departments}
                            schoolId={selfForm.data.school_id}
                            targetId={selfForm.data.target_id}
                            departmentId={selfForm.data.department_id}
                            errors={selfForm.errors}
                            onSchool={(v) => selfForm.setData((d) => ({ ...d, school_id: v, target_id: '' }))}
                            onTarget={(v) => selfForm.setData('target_id', v)}
                            onDepartment={(v) => selfForm.setData('department_id', v)}
                        />
                    )}
                    {editingSelf && (
                        <div className="bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-sm">
                            {editingSelf.target?.name} — {editingSelf.school?.name}
                        </div>
                    )}
                    <GoalsEditor value={selfForm.data.goals} onChange={(g) => selfForm.setData('goals', g)} label="أهداف التطوير الذاتي" />
                    <div className="space-y-2">
                        <Label htmlFor="feedback">تغذية راجعة من الموجّه</Label>
                        <textarea
                            id="feedback"
                            rows={3}
                            className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                            value={selfForm.data.supervisor_feedback}
                            onChange={(e) => selfForm.setData('supervisor_feedback', e.target.value)}
                        />
                    </div>
                    {editingSelf && (
                        <div className="space-y-2">
                            <Label>الحالة</Label>
                            <Select value={selfForm.data.status} onValueChange={(v) => selfForm.setData('status', v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </FormSection>
            </FormDialog>

            <ConfirmDialog
                open={!!deletingPlan}
                onOpenChange={(o) => !o && setDeletingPlan(null)}
                title="حذف خطة التحسين"
                description="سيتم حذف الخطة وكل مراجعاتها. لا يمكن التراجع."
                onConfirm={() =>
                    deletingPlan &&
                    router.delete(`/improvement/${deletingPlan.id}`, {
                        onSuccess: () => {
                            setDeletingPlan(null);
                            toast.success('تم الحذف');
                        },
                    })
                }
            />
            <ConfirmDialog
                open={!!deletingSelf}
                onOpenChange={(o) => !o && setDeletingSelf(null)}
                title="حذف خطة التطوير الذاتي"
                description="لا يمكن التراجع."
                onConfirm={() =>
                    deletingSelf &&
                    router.delete(`/improvement-self/${deletingSelf.id}`, {
                        onSuccess: () => {
                            setDeletingSelf(null);
                            toast.success('تم الحذف');
                        },
                    })
                }
            />
        </AppLayout>
    );
}

/** حقول اختيار المستهدف المشتركة: المدرسة ← المعلم + المادة. */
function TargetFields({
    schools,
    teachersOf,
    userDepartment,
    departments,
    schoolId,
    targetId,
    departmentId,
    errors,
    onSchool,
    onTarget,
    onDepartment,
}: {
    schools: SchoolOpt[];
    teachersOf: (schoolId: string) => { value: string; label: string }[];
    userDepartment: Opt | null;
    departments: Opt[];
    schoolId: string;
    targetId: string;
    departmentId: string;
    errors: Partial<Record<string, string>>;
    onSchool: (v: string) => void;
    onTarget: (v: string) => void;
    onDepartment: (v: string) => void;
}) {
    return (
        <>
            <div className="space-y-2">
                <Label>المدرسة</Label>
                <Combobox
                    items={schools.map((s) => ({ value: String(s.id), label: s.name }))}
                    value={schoolId}
                    onChange={onSchool}
                    placeholder="ابحث عن المدرسة"
                    emptyText="لا توجد مدارس"
                />
                {errors.school_id && <p className="text-destructive text-xs">{errors.school_id}</p>}
            </div>
            <div className="space-y-2">
                <Label>المعلم / المنسق</Label>
                <Combobox
                    items={teachersOf(schoolId)}
                    value={targetId}
                    onChange={onTarget}
                    placeholder={schoolId ? 'ابحث عن المعلم' : 'اختر المدرسة أولًا'}
                    emptyText="لا يوجد معلمون"
                    disabled={!schoolId}
                />
                {errors.target_id && <p className="text-destructive text-xs">{errors.target_id}</p>}
            </div>
            <div className="space-y-2">
                <Label>المادة</Label>
                {userDepartment ? (
                    <div className="border-input bg-muted/40 text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm">{userDepartment.name}</div>
                ) : (
                    <Select value={departmentId} onValueChange={onDepartment}>
                        <SelectTrigger>
                            <SelectValue placeholder="اختر المادة" />
                        </SelectTrigger>
                        <SelectContent>
                            {departments.map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>
                                    {d.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {errors.department_id && <p className="text-destructive text-xs">{errors.department_id}</p>}
            </div>
        </>
    );
}

/** محرّر قائمة أهداف ديناميكية (إضافة/حذف أسطر). */
export function GoalsEditor({ value, onChange, label = 'الأهداف' }: { value: string[]; onChange: (goals: string[]) => void; label?: string }) {
    const update = (i: number, text: string) => onChange(value.map((g, idx) => (idx === i ? text : g)));
    const add = () => onChange([...value, '']);
    const remove = (i: number) => onChange(value.length > 1 ? value.filter((_, idx) => idx !== i) : ['']);
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="space-y-2">
                {value.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="text-muted-foreground tnum w-5 text-center text-xs">{i + 1}.</span>
                        <Input value={g} onChange={(e) => update(i, e.target.value)} placeholder="اكتب هدفًا..." />
                        <button type="button" onClick={() => remove(i)} aria-label="حذف الهدف" className="text-muted-foreground hover:text-destructive">
                            <X className="size-4" />
                        </button>
                    </div>
                ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={add} className={cn('gap-1')}>
                <Plus className="size-4" /> إضافة هدف
            </Button>
        </div>
    );
}

/* ===================== التبديل بين المستويات ===================== */
export default function ImprovementIndex(props: Readonly<PageProps>) {
    if (props.view === 'departments') {
        return (
            <DepartmentsLevel
                base="/improvement"
                crumbLabel="خطط التحسين والتطوير"
                title="خطط التحسين والتطوير"
                description="اختر القسم لعرض موجّهيه وخطط تحسينهم"
                unit="خطة"
                departments={props.departmentCards ?? []}
            />
        );
    }

    if (props.view === 'supervisors') {
        return (
            <SupervisorsLevel
                base="/improvement"
                crumbLabel="خطط التحسين والتطوير"
                department={props.contextDepartment ?? null}
                description="اختر الموجّه لعرض خطط التحسين والتطوير الخاصة به"
                unit="خطة"
                supervisors={props.supervisors ?? []}
                canDrillDepartments={props.canDrillDepartments}
            />
        );
    }

    return (
        <ContentLevel
            plans={props.plans ?? []}
            selfPlans={props.selfPlans ?? []}
            schools={props.schools ?? []}
            teachers={props.teachers ?? []}
            userDepartment={props.userDepartment ?? null}
            departments={props.departments ?? []}
            canCreate={props.canCreate ?? false}
            canEdit={props.canEdit ?? false}
            supervisor={props.supervisor}
            contextDepartment={props.contextDepartment}
            canDrillSupervisors={props.canDrillSupervisors}
        />
    );
}
