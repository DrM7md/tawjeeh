import { usePermissions } from '@/components/shared/can';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AppLayout from '@/layouts/app-layout';
import { BoardCard, aggregate, type Stats } from '@/components/shared/drilldown-cards';
import { formatDate } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import {
    AlertTriangle,
    BarChart3,
    Building2,
    CalendarPlus,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ClipboardList,
    Clock,
    FileText,
    Plus,
    Printer,
    School,
    Trash2,
    UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface DeptBoard extends Stats {
    id: number;
    name: string;
}
interface SupBoard extends Stats {
    id: number;
    name: string;
    schools: number;
}
interface Target {
    id: number;
    type: 'teacher' | 'coordinator';
    name: string;
    school: string | null;
    school_id: number;
    department_id: number;
    classification: string | null;
    required: number;
    done_year: number;
    done_semester: number;
    status: 'done' | 'remaining' | 'late';
}
interface VisitRow {
    id: number;
    visit_type: string;
    visit_date: string;
    school?: { name: string };
    supervisor?: { name: string };
    visitable?: { name: string };
    form?: { save_status: string } | null;
}
interface NamedRef {
    id: number;
    name: string;
}
interface PageProps {
    view: 'departments' | 'supervisors' | 'visits';
    // مستوى الأقسام
    departments?: DeptBoard[];
    // مستوى الموجهين
    department?: NamedRef | null;
    supervisors?: SupBoard[];
    canDrillDepartments?: boolean;
    // مستوى الزيارات
    followUp?: { targets: Target[]; stats: Stats };
    visits?: VisitRow[];
    supervisor?: NamedRef | null;
    canDrillSupervisors?: boolean;
}

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    done: { label: 'تمت ✓', variant: 'default' },
    remaining: { label: 'متبقٍ', variant: 'secondary' },
    late: { label: 'متأخر', variant: 'destructive' },
};

const reportLinks = [
    { href: '/supervision-reports/department', label: 'تقرير الأقسام' },
    { href: '/supervision-reports/comparison', label: 'مقارنة المعلمين' },
    { href: '/supervision-reports/performance', label: 'أداء معلم عبر الأعوام' },
    { href: '/supervision-reports/coverage', label: 'تغطية الزيارات' },
    { href: '/supervision-reports/recommendations', label: 'متابعة التوصيات' },
    { href: '/supervision-reports/cross-year', label: 'إحصائيات شاملة' },
];

export default function VisitsIndex(props: PageProps) {
    const { view } = props;
    const { can } = usePermissions();
    const canCreate = can('visits.create');

    const reportsMenu = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    <BarChart3 className="size-4" /> تقارير
                    <ChevronDown className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                {reportLinks.map((r) => (
                    <DropdownMenuItem key={r.href} asChild>
                        <Link href={r.href}>{r.label}</Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    /* ===================== مستوى الأقسام ===================== */
    if (view === 'departments') {
        const departments = props.departments ?? [];
        const totals = aggregate(departments);
        const breadcrumbs: BreadcrumbItem[] = [
            { title: 'لوحة التحكم', href: '/dashboard' },
            { title: 'الزيارات', href: '/visits' },
        ];

        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="الزيارات — الأقسام" />
                <div className="flex flex-col gap-6 p-4 md:p-6">
                    <PageHeader title="الزيارات والمتابعة" description="اختر القسم لعرض موجّهيه ونِسب إنجازهم" actions={reportsMenu} />

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="نسبة الإنجاز الكلية"
                            value={`${totals.completion}%`}
                            icon={ClipboardList}
                            tone="primary"
                            hint={`${totals.total} مستهدف`}
                        />
                        <StatCard title="تمت" value={totals.done} icon={CheckCircle2} tone="success" />
                        <StatCard title="متبقٍ" value={totals.remaining} icon={Clock} tone="warning" />
                        <StatCard title="متأخر" value={totals.late} icon={AlertTriangle} tone="destructive" />
                    </div>

                    {departments.length === 0 ? (
                        <Card className="text-muted-foreground p-8 text-center">لا توجد أقسام</Card>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {departments.map((d) => (
                                <BoardCard key={d.id} href={`/visits?department=${d.id}`} name={d.name} icon={Building2} stats={d} />
                            ))}
                        </div>
                    )}
                </div>
            </AppLayout>
        );
    }

    /* ===================== مستوى الموجهين ===================== */
    if (view === 'supervisors') {
        const supervisors = props.supervisors ?? [];
        const department = props.department ?? null;
        const totals = aggregate(supervisors);
        const breadcrumbs: BreadcrumbItem[] = [
            { title: 'لوحة التحكم', href: '/dashboard' },
            { title: 'الزيارات', href: '/visits' },
            { title: department?.name ?? 'القسم', href: '#' },
        ];

        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`الزيارات — ${department?.name ?? 'الموجهون'}`} />
                <div className="flex flex-col gap-6 p-4 md:p-6">
                    {props.canDrillDepartments && (
                        <Button variant="ghost" size="sm" className="-mb-2 w-fit" asChild>
                            <Link href="/visits">
                                <ChevronLeft className="size-4 rotate-180" /> رجوع إلى الأقسام
                            </Link>
                        </Button>
                    )}
                    <PageHeader title={department?.name ?? 'الموجهون'} description="اختر الموجّه لعرض لوحة متابعته وزياراته" actions={reportsMenu} />

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="نسبة إنجاز القسم"
                            value={`${totals.completion}%`}
                            icon={ClipboardList}
                            tone="primary"
                            hint={`${supervisors.length} موجّه`}
                        />
                        <StatCard title="تمت" value={totals.done} icon={CheckCircle2} tone="success" />
                        <StatCard title="متبقٍ" value={totals.remaining} icon={Clock} tone="warning" />
                        <StatCard title="متأخر" value={totals.late} icon={AlertTriangle} tone="destructive" />
                    </div>

                    {supervisors.length === 0 ? (
                        <Card className="text-muted-foreground p-8 text-center">لا يوجد موجّهون في هذا القسم</Card>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {supervisors.map((s) => (
                                <BoardCard
                                    key={s.id}
                                    href={`/visits?supervisor=${s.id}`}
                                    name={s.name}
                                    icon={UserRound}
                                    subtitle={`${s.schools} مدرسة مكلّف بها`}
                                    stats={s}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </AppLayout>
        );
    }

    /* ===================== مستوى الزيارات ===================== */
    return <VisitsLevel {...props} canCreate={canCreate} reportsMenu={reportsMenu} />;
}

/** المستوى الأخير: لوحة المتابعة + الزيارات المسجّلة (لموجّه محدد أو للمستخدم نفسه). */
function VisitsLevel({
    followUp,
    visits = [],
    supervisor = null,
    department = null,
    canDrillSupervisors,
    canCreate,
    reportsMenu,
}: PageProps & { canCreate: boolean; reportsMenu: React.ReactNode }) {
    const stats = followUp?.stats ?? { total: 0, done: 0, remaining: 0, late: 0, completion: 0 };
    const targets = followUp?.targets ?? [];

    const [deleting, setDeleting] = useState<VisitRow | null>(null);

    const heading = supervisor ? `زيارات ${supervisor.name}` : 'الزيارات والمتابعة';
    // رابط الرجوع: إلى موجّهي القسم إن كنّا داخل موجّه، وإلا فلا رجوع (موجه يرى لوحته).
    const backHref = supervisor ? (department ? `/visits?department=${department.id}` : '/visits') : null;
    const backLabel = department ? `رجوع إلى موجّهي ${department.name}` : 'رجوع';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'الزيارات', href: '/visits' },
        ...(department ? [{ title: department.name, href: `/visits?department=${department.id}` }] : []),
        ...(supervisor ? [{ title: supervisor.name, href: '#' }] : []),
    ];

    const confirmDelete = () => {
        if (!deleting) return;
        router.delete(`/visits/${deleting.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setDeleting(null);
                toast.success('تم حذف الزيارة');
            },
        });
    };

    const targetColumns: ColumnDef<Target>[] = [
        { accessorKey: 'name', header: 'المستهدف', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { accessorKey: 'type', header: 'النوع', cell: ({ row }) => (row.original.type === 'teacher' ? 'معلم' : 'منسق') },
        { accessorKey: 'school', header: 'المدرسة', cell: ({ row }) => row.original.school ?? '—' },
        { accessorKey: 'classification', header: 'التصنيف', cell: ({ row }) => row.original.classification ?? '—' },
        {
            id: 'progress',
            header: 'الإنجاز',
            cell: ({ row }) => (
                <span className="tnum">
                    {row.original.done_year}/{row.original.required}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'الحالة',
            cell: ({ row }) => <Badge variant={statusBadge[row.original.status].variant}>{statusBadge[row.original.status].label}</Badge>,
        },
        ...(canCreate
            ? [
                  {
                      id: 'actions',
                      header: '',
                      cell: ({ row }: { row: { original: Target } }) =>
                          row.original.type === 'teacher' ? (
                              <Button variant="ghost" size="sm" asChild>
                                  <Link href={`/visits/create?teacher_id=${row.original.id}`}>
                                      <CalendarPlus className="size-4" /> تسجيل زيارة
                                  </Link>
                              </Button>
                          ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                          ),
                  },
              ]
            : []),
    ];

    const visitColumns: ColumnDef<VisitRow>[] = [
        { accessorKey: 'visit_date', header: 'التاريخ', cell: ({ row }) => <span className="tnum">{formatDate(row.original.visit_date)}</span> },
        { id: 'target', header: 'المستهدف', cell: ({ row }) => row.original.visitable?.name ?? '—' },
        { accessorKey: 'visit_type', header: 'النوع', cell: ({ row }) => (row.original.visit_type === 'teacher' ? 'معلم' : 'منسق') },
        { id: 'school', header: 'المدرسة', cell: ({ row }) => row.original.school?.name ?? '—' },
        { id: 'supervisor', header: 'الموجه', cell: ({ row }) => row.original.supervisor?.name ?? '—' },
        {
            id: 'form',
            header: 'الاستمارة',
            cell: ({ row }) =>
                row.original.form ? (
                    <Badge variant={row.original.form.save_status === 'final' ? 'default' : 'secondary'}>
                        {row.original.form.save_status === 'final' ? 'معتمدة' : 'مسودة'}
                    </Badge>
                ) : (
                    <Badge variant="destructive">بلا استمارة</Badge>
                ),
        },
        {
            id: 'open',
            header: '',
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/visits/${row.original.id}/edit`}>
                            <FileText className="size-4" /> فتح
                        </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild aria-label="طباعة الزيارة">
                        <a href={`/visits/${row.original.id}/print`} target="_blank" rel="noreferrer">
                            <Printer className="size-4" />
                        </a>
                    </Button>
                    {canCreate && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} aria-label="حذف الزيارة">
                            <Trash2 className="text-destructive size-4" />
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    const classifications = Array.from(new Set(targets.map((t) => t.classification).filter(Boolean))) as string[];
    const targetSchools = [...new Set(targets.map((t) => t.school).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'ar'));
    const targetFilters: DataTableFilter<Target>[] = [
        {
            id: 'status',
            label: 'الحالة',
            variant: 'tabs',
            options: [
                { value: 'done', label: 'تمت' },
                { value: 'remaining', label: 'متبقٍ' },
                { value: 'late', label: 'متأخر' },
            ],
            getValue: (t) => t.status,
        },
        ...(targetSchools.length > 1
            ? [
                  {
                      id: 'school',
                      label: 'المدرسة',
                      variant: 'search' as const,
                      options: targetSchools.map((s) => ({ value: s, label: s })),
                      getValue: (t: Target) => t.school ?? '',
                  },
              ]
            : []),
        {
            id: 'type',
            label: 'النوع',
            options: [
                { value: 'teacher', label: 'معلم' },
                { value: 'coordinator', label: 'منسق' },
            ],
            getValue: (t) => t.type,
        },
        ...(classifications.length
            ? [
                  {
                      id: 'classification',
                      label: 'التصنيف',
                      options: classifications.map((c) => ({ value: c, label: c })),
                      getValue: (t: Target) => t.classification ?? '',
                  },
              ]
            : []),
    ];

    const visitSchools = [...new Set(visits.map((v) => v.school?.name).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'ar'));
    const visitFilters: DataTableFilter<VisitRow>[] = [
        ...(visitSchools.length > 1
            ? [
                  {
                      id: 'school',
                      label: 'المدرسة',
                      variant: 'search' as const,
                      options: visitSchools.map((s) => ({ value: s, label: s })),
                      getValue: (v: VisitRow) => v.school?.name ?? '',
                  },
              ]
            : []),
        {
            id: 'type',
            label: 'النوع',
            options: [
                { value: 'teacher', label: 'معلم' },
                { value: 'coordinator', label: 'منسق' },
            ],
            getValue: (v) => v.visit_type,
        },
        {
            id: 'form',
            label: 'الاستمارة',
            options: [
                { value: 'final', label: 'معتمدة' },
                { value: 'draft', label: 'مسودة' },
                { value: 'none', label: 'بلا استمارة' },
            ],
            getValue: (v) => v.form?.save_status ?? 'none',
        },
    ];

    const renderTargetCard = (t: Target) => (
        <Card className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{t.name}</span>
                <Badge variant={statusBadge[t.status].variant}>{statusBadge[t.status].label}</Badge>
            </div>
            <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="flex flex-col">
                    <dt className="text-xs">النوع</dt>
                    <dd className="text-foreground">{t.type === 'teacher' ? 'معلم' : 'منسق'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">المدرسة</dt>
                    <dd className="text-foreground">{t.school ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">التصنيف</dt>
                    <dd className="text-foreground">{t.classification ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">الإنجاز</dt>
                    <dd className="text-foreground tnum">
                        {t.done_year}/{t.required}
                    </dd>
                </div>
            </dl>
            {canCreate && t.type === 'teacher' && (
                <div className="border-border/60 mt-auto border-t pt-2">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/visits/create?teacher_id=${t.id}`}>
                            <CalendarPlus className="size-4" /> تسجيل زيارة
                        </Link>
                    </Button>
                </div>
            )}
        </Card>
    );

    const renderVisitCard = (v: VisitRow) => (
        <Card className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{v.visitable?.name ?? '—'}</span>
                {v.form ? (
                    <Badge variant={v.form.save_status === 'final' ? 'default' : 'secondary'}>
                        {v.form.save_status === 'final' ? 'معتمدة' : 'مسودة'}
                    </Badge>
                ) : (
                    <Badge variant="destructive">بلا استمارة</Badge>
                )}
            </div>
            <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="flex flex-col">
                    <dt className="text-xs">التاريخ</dt>
                    <dd className="text-foreground tnum">{formatDate(v.visit_date)}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">النوع</dt>
                    <dd className="text-foreground">{v.visit_type === 'teacher' ? 'معلم' : 'منسق'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">المدرسة</dt>
                    <dd className="text-foreground">{v.school?.name ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">الموجه</dt>
                    <dd className="text-foreground">{v.supervisor?.name ?? '—'}</dd>
                </div>
            </dl>
            <div className="border-border/60 mt-auto flex items-center justify-between border-t pt-2">
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/visits/${v.id}/edit`}>
                        <FileText className="size-4" /> فتح
                    </Link>
                </Button>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild aria-label="طباعة الزيارة">
                        <a href={`/visits/${v.id}/print`} target="_blank" rel="noreferrer">
                            <Printer className="size-4" />
                        </a>
                    </Button>
                    {canCreate && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(v)} aria-label="حذف الزيارة">
                            <Trash2 className="text-destructive size-4" />
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={heading} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {backHref && (canDrillSupervisors || department) && (
                    <Button variant="ghost" size="sm" className="-mb-2 w-fit" asChild>
                        <Link href={backHref}>
                            <ChevronLeft className="size-4 rotate-180" /> {backLabel}
                        </Link>
                    </Button>
                )}
                <PageHeader
                    title={heading}
                    description={
                        supervisor ? `${supervisor.name} — متابعة الإنجاز حسب العام والفصل المختار` : 'متابعة إنجاز الزيارات حسب العام والفصل المختار'
                    }
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            {canCreate && (
                                <Button asChild>
                                    <Link href="/visits/create">
                                        <Plus className="size-4" /> زيارة جديدة
                                    </Link>
                                </Button>
                            )}
                            {reportsMenu}
                        </div>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="نسبة الإنجاز"
                        value={`${stats.completion}%`}
                        icon={ClipboardList}
                        tone="primary"
                        hint={`${stats.total} مستهدف`}
                    />
                    <StatCard title="تمت" value={stats.done} icon={CheckCircle2} tone="success" />
                    <StatCard title="متبقٍ" value={stats.remaining} icon={Clock} tone="warning" />
                    <StatCard title="متأخر" value={stats.late} icon={AlertTriangle} tone="destructive" />
                </div>

                <div className="space-y-3">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                        <School className="text-muted-foreground size-5" /> لوحة المتابعة
                    </h2>
                    <DataTable
                        columns={targetColumns}
                        data={targets}
                        searchPlaceholder="ابحث عن معلم/منسق..."
                        pageSize={15}
                        emptyMessage="لا يوجد مستهدفون — تأكد من الاستيراد والتوزيع"
                        storageKey="view:visit-targets"
                        filters={targetFilters}
                        renderCard={renderTargetCard}
                    />
                </div>

                <div className="space-y-3">
                    <h2 className="text-xl font-semibold">الزيارات المسجّلة</h2>
                    <DataTable
                        columns={visitColumns}
                        data={visits}
                        searchPlaceholder="ابحث في الزيارات..."
                        emptyMessage="لا توجد زيارات بعد"
                        storageKey="view:visits"
                        filters={visitFilters}
                        renderCard={renderVisitCard}
                    />
                </div>
            </div>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف الزيارة"
                description={`سيتم حذف زيارة «${deleting?.visitable?.name ?? ''}» بتاريخ ${deleting ? formatDate(deleting.visit_date) : ''} وكل تقييماتها. لا يمكن التراجع.`}
                confirmLabel="حذف"
                onConfirm={confirmDelete}
            />
        </AppLayout>
    );
}
