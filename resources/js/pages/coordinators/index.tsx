import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
import { BoardCard, DrilldownBack, GenderTabs, supervisorInGenderTab, type GenderTab } from '@/components/shared/drilldown-cards';
import { FormDialog } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { Building2, Download, LayoutGrid, List, Upload, UserMinus, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type SchoolGender = 'boys' | 'girls' | 'mixed' | null;
type SupervisorGender = 'male' | 'female' | null;

interface Coordinator {
    id: number;
    teacher_id: number;
    name: string | null;
    national_id: string | null;
    phone: string | null;
    email: string | null;
    department: string | null;
    school: string | null;
    gender: SchoolGender;
    classification: string | null;
    classification_color: string | null;
    start_date: string | null;
    end_date: string | null;
    tenure: string;
    tenure_months: number;
    status: 'active' | 'ended';
    ended_reason: string | null;
    supervisor_id: number | null;
    supervisor: string | null;
    supervisor_gender: SupervisorGender;
}

interface NamedRef {
    id: number;
    name: string;
}
interface DeptCount {
    id: number;
    name: string;
    count: number;
}
interface SupCount {
    id: number;
    name: string;
    gender: SupervisorGender;
    count: number;
    schools: number;
}

interface PageProps {
    view: 'departments' | 'supervisors' | 'content';
    // مستوى الأقسام
    departmentCards?: DeptCount[];
    // مستوى الموجهين
    department?: NamedRef | null;
    supervisors?: SupCount[];
    canDrillDepartments?: boolean;
    // محتوى القائمة (مستوى الموجهين «كل المنسقين» + مستوى الموجّه)
    coordinators?: Coordinator[];
    departments?: NamedRef[];
    schools?: NamedRef[];
    canManage?: boolean;
    supervisor?: NamedRef | null;
    canDrillSupervisors?: boolean;
}

const statusBadge = (c: Coordinator) =>
    c.status === 'active' ? <Badge>منسق حالي</Badge> : <Badge variant="secondary">مُنزَّل لمعلم</Badge>;

const normalizeColor = (raw: string | null): string | undefined => {
    if (!raw) return undefined;
    return raw.startsWith('#') ? raw : `#${raw}`;
};

const classificationBadge = (c: Coordinator) => {
    if (!c.classification) return <span className="text-muted-foreground">—</span>;
    const color = normalizeColor(c.classification_color);
    return (
        <Badge variant="outline" style={color ? { borderColor: color, color } : undefined}>
            {c.classification}
        </Badge>
    );
};

/** المنسق يظهر في التبويب المختار حسب نوع مدرسته (المشترك/غير المحدّد يظهر دائمًا). */
const inGenderTab = (g: SchoolGender, tab: GenderTab) => tab === 'all' || !g || g === 'mixed' || g === tab;

/** قائمة منسقين قابلة للبحث/الفرز + تبويب بنين/بنات + تنزيل منسق إلى معلم. مستقلّة بذاتها. */
function CoordinatorListView({
    coordinators,
    departments,
    schools,
    canManage,
}: Readonly<{ coordinators: Coordinator[]; departments: NamedRef[]; schools: NamedRef[]; canManage: boolean }>) {
    const [genderTab, setGenderTab] = useState<GenderTab>('all');
    const [demoting, setDemoting] = useState<Coordinator | null>(null);
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const shown = useMemo(() => coordinators.filter((c) => inGenderTab(c.gender, genderTab)), [coordinators, genderTab]);

    const openDemote = (c: Coordinator) => {
        setReason('');
        setDemoting(c);
    };
    const confirmDemote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!demoting) return;
        setProcessing(true);
        router.post(
            `/coordinators/${demoting.id}/demote`,
            { ended_reason: reason },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('تم التنزيل إلى معلم');
                    setDemoting(null);
                },
                onError: () => toast.error('تعذّر تنفيذ العملية'),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const columns: ColumnDef<Coordinator>[] = [
        { accessorKey: 'name', header: 'اسم المنسق', cell: ({ row }) => <span className="font-medium">{row.original.name ?? '—'}</span> },
        { id: 'department', header: 'المادة / القسم', cell: ({ row }) => row.original.department ?? '—' },
        { id: 'school', header: 'المدرسة', cell: ({ row }) => row.original.school ?? '—' },
        { id: 'supervisor', header: 'الموجّه', cell: ({ row }) => row.original.supervisor ?? <span className="text-muted-foreground">—</span> },
        { accessorKey: 'start_date', header: 'تاريخ التعيين', cell: ({ row }) => row.original.start_date ?? '—' },
        { id: 'tenure', header: 'مدة التنسيق', cell: ({ row }) => row.original.tenure },
        { id: 'classification', header: 'التصنيف الحالي', cell: ({ row }) => classificationBadge(row.original) },
        { id: 'status', header: 'الحالة', cell: ({ row }) => statusBadge(row.original) },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) =>
                canManage && row.original.status === 'active' ? (
                    <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openDemote(row.original)}>
                            <UserMinus className="size-4" /> تنزيل كمعلم
                        </Button>
                    </div>
                ) : null,
        },
    ];

    const filters: DataTableFilter<Coordinator>[] = [
        {
            id: 'department',
            label: 'المادة / القسم',
            variant: departments.length > 6 ? 'search' : 'select',
            options: departments.map((d) => ({ value: d.name, label: d.name })),
            getValue: (c) => c.department ?? '',
        },
        {
            id: 'school',
            label: 'المدرسة',
            variant: 'search',
            options: schools.map((s) => ({ value: s.name, label: s.name })),
            getValue: (c) => c.school ?? '',
        },
        {
            id: 'status',
            label: 'الحالة',
            variant: 'tabs',
            options: [
                { value: 'active', label: 'منسق حالي' },
                { value: 'ended', label: 'مُنزَّل' },
            ],
            getValue: (c) => c.status,
        },
    ];

    const renderCard = (c: Coordinator) => (
        <Card className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{c.name ?? '—'}</span>
                {statusBadge(c)}
            </div>
            <div className="text-muted-foreground text-xs">
                {c.school ?? '—'} · {c.department ?? '—'}
            </div>
            <div className="flex items-center justify-between">
                {classificationBadge(c)}
                <span className="text-muted-foreground text-xs">{c.tenure}</span>
            </div>
            {canManage && c.status === 'active' && (
                <div className="mt-auto flex justify-end border-t border-border/60 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => openDemote(c)}>
                        <UserMinus className="size-4" /> تنزيل كمعلم
                    </Button>
                </div>
            )}
        </Card>
    );

    return (
        <>
            <GenderTabs value={genderTab} onChange={setGenderTab} />
            <DataTable
                columns={columns}
                data={shown}
                searchPlaceholder="ابحث عن منسق بالاسم..."
                storageKey="view:coordinators"
                filters={filters}
                renderCard={renderCard}
                emptyMessage="لا يوجد منسقون ضمن هذا التبويب"
            />

            <FormDialog
                open={!!demoting}
                onOpenChange={(o) => !o && setDemoting(null)}
                title="تنزيل المنسق إلى معلم"
                description={`سيُغلق تكليف التنسيق لـ «${demoting?.name}» مع حفظ كامل السجل السابق. يبقى معلمًا في النظام.`}
                onSubmit={confirmDemote}
                loading={processing}
                submitLabel="تأكيد التنزيل"
            >
                <div className="space-y-2">
                    <Label htmlFor="reason">سبب التنزيل (اختياري)</Label>
                    <textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="مثال: قرار الإدارة بناءً على التقييم، أو نهاية فترة التكليف"
                        rows={3}
                        className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                    />
                </div>
            </FormDialog>
        </>
    );
}

const PageActions = ({ canManage }: { canManage: boolean }) => (
    <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
            <a href="/coordinators-export">
                <Download className="size-4" /> تصدير Excel
            </a>
        </Button>
        {canManage && (
            <Button asChild>
                <Link href="/roster-import">
                    <Upload className="size-4" /> الاستيراد الموحّد
                </Link>
            </Button>
        )}
    </div>
);

/* ===================== مستوى الأقسام ===================== */
function DepartmentsLevel({ departments }: Readonly<{ departments: DeptCount[] }>) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'المنسقون', href: '/coordinators' },
    ];
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="المنسقون — الأقسام" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="المنسقون" description="اختر القسم لعرض موجّهيه ومنسّقيهم" />
                {departments.length === 0 ? (
                    <Card className="text-muted-foreground p-8 text-center">لا توجد أقسام</Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {departments.map((d) => (
                            <BoardCard key={d.id} href={`/coordinators?department=${d.id}`} name={d.name} icon={Building2} metric={{ label: 'منسق', value: d.count }} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

/* ===================== مستوى الموجهين (بطاقات الموجهين ⇄ كل المنسقين) ===================== */
function SupervisorsLevel({ department, supervisors, canDrillDepartments, coordinators, departments, schools, canManage }: Readonly<PageProps>) {
    const [mode, setMode] = useState<'supervisors' | 'all'>('supervisors');
    const [genderTab, setGenderTab] = useState<GenderTab>('all');
    const sups = supervisors ?? [];
    const visibleSups = sups.filter((s) => supervisorInGenderTab(s.gender, genderTab));

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'المنسقون', href: '/coordinators' },
        { title: department?.name ?? 'القسم', href: '#' },
    ];

    const toggle = (
        <ToggleGroup type="single" value={mode} onValueChange={(v) => (v === 'supervisors' || v === 'all') && setMode(v)} className="shrink-0">
            <ToggleGroupItem value="supervisors" aria-label="بطاقات الموجهين" title="بطاقة لكل موجّه">
                <LayoutGrid className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="all" aria-label="كل المنسقين والمنسقات" title="عرض جميع المنسقين والمنسقات">
                <List className="size-4" />
            </ToggleGroupItem>
        </ToggleGroup>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`المنسقون — ${department?.name ?? 'الموجهون'}`} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {canDrillDepartments && <DrilldownBack href="/coordinators" label="رجوع إلى الأقسام" />}
                <PageHeader
                    title={department?.name ?? 'الموجهون'}
                    description={mode === 'supervisors' ? 'اختر الموجّه لعرض منسّقيه، أو بدّل لعرض جميع المنسقين' : 'كل المنسقين والمنسقات في القسم'}
                    actions={<PageActions canManage={canManage ?? false} />}
                />

                {mode === 'supervisors' ? (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <GenderTabs value={genderTab} onChange={setGenderTab} />
                            {toggle}
                        </div>
                        {visibleSups.length === 0 ? (
                            <Card className="text-muted-foreground p-8 text-center">
                                {sups.length === 0 ? 'لا يوجد موجّهون في هذا القسم' : 'لا يوجد موجّهون مطابقون لهذا التبويب'}
                            </Card>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {visibleSups.map((s) => (
                                    <BoardCard
                                        key={s.id}
                                        href={`/coordinators?supervisor=${s.id}`}
                                        name={s.name}
                                        icon={UserRound}
                                        gender={s.gender}
                                        subtitle={`${s.schools} مدرسة`}
                                        metric={{ label: 'منسق', value: s.count }}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-end">{toggle}</div>
                        <CoordinatorListView coordinators={coordinators ?? []} departments={departments ?? []} schools={schools ?? []} canManage={canManage ?? false} />
                    </>
                )}
            </div>
        </AppLayout>
    );
}

/* ===================== مستوى الموجّه: منسّقوه ===================== */
function ContentLevel({ coordinators, departments, schools, canManage, supervisor, canDrillSupervisors }: Readonly<PageProps>) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'المنسقون', href: '/coordinators' },
        ...(supervisor ? [{ title: supervisor.name, href: '#' }] : []),
    ];
    const title = supervisor ? `منسّقو: ${supervisor.name}` : 'المنسقون';
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={title} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {supervisor && canDrillSupervisors && <DrilldownBack href="/coordinators" label="رجوع إلى الموجهين" />}
                <PageHeader title={title} description="المنسقون التابعون لهذا الموجّه" actions={<PageActions canManage={canManage ?? false} />} />
                <CoordinatorListView coordinators={coordinators ?? []} departments={departments ?? []} schools={schools ?? []} canManage={canManage ?? false} />
            </div>
        </AppLayout>
    );
}

/* ===================== التبديل بين المستويات ===================== */
export default function CoordinatorsIndex(props: Readonly<PageProps>) {
    if (props.view === 'departments') {
        return <DepartmentsLevel departments={props.departmentCards ?? []} />;
    }
    if (props.view === 'supervisors') {
        return <SupervisorsLevel {...props} />;
    }
    return <ContentLevel {...props} />;
}
