import { usePermissions } from '@/components/shared/can';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
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
import { PageHeader } from '@/components/shared/page-header';
import { GaugeCard } from '@/components/shared/stat-charts';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import { formatDate } from '@/lib/utils';
import { type BreadcrumbItem, type PortfolioReview } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Building2, CheckCircle2, Clock, ClipboardList, FileText, FolderCheck, Play, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Term = 'first' | 'second';
const TERMS: { value: Term; label: string }[] = [
    { value: 'first', label: 'الفصل الأول' },
    { value: 'second', label: 'الفصل الثاني' },
];

interface CoordinatorOpt {
    teacher_id: number;
    name: string;
    school: string | null;
    gender: 'boys' | 'girls' | 'mixed' | null;
    department: string | null;
    department_id: number | null;
    supervisor: string | null;
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

interface ContentProps {
    coordinators: CoordinatorOpt[];
    reviews: PortfolioReview[];
    hasTemplate: boolean;
    supervisor?: NamedRef | null;
    department?: NamedRef | null;
    canDrillSupervisors?: boolean;
}

interface PageProps {
    view: 'departments' | 'supervisors' | 'content';
    // مستوى الأقسام
    departments?: DeptBoard[];
    // مستوى الموجهين
    supervisors?: SupBoard[];
    canDrillDepartments?: boolean;
    // مستوى المحتوى
    coordinators?: CoordinatorOpt[];
    reviews?: PortfolioReview[];
    hasTemplate?: boolean;
    supervisor?: NamedRef | null;
    department?: NamedRef | null;
    canDrillSupervisors?: boolean;
}

/** صف الجدول: منسق + تقييمه في الفصل المختار (إن وُجد). */
interface Row {
    teacher_id: number;
    name: string;
    school: string;
    gender: 'boys' | 'girls' | 'mixed' | null;
    department: string;
    supervisor: string;
    review: PortfolioReview | null;
}

const GENDER_LABEL: Record<string, string> = { boys: 'بنين', girls: 'بنات', mixed: 'مشترك' };

function ContentLevel({ coordinators, reviews, hasTemplate, supervisor, department, canDrillSupervisors }: Readonly<ContentProps>) {
    const { can } = usePermissions();
    const canCreate = can('portfolios.create');

    const backHref = department ? `/portfolios?department=${department.id}` : '/portfolios';
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'تقييم ملفات المنسق', href: '/portfolios' },
        ...(supervisor ? [{ title: supervisor.name, href: '#' }] : []),
    ];
    const pageTitle = supervisor ? `تقييم ملفات المنسق — ${supervisor.name}` : 'تقييم ملفات المنسق';

    const [deleting, setDeleting] = useState<PortfolioReview | null>(null);
    const [starting, setStarting] = useState(false);

    // التاب المختار (الفصل) — يُحفظ آخر اختيار في المتصفح
    const TERM_KEY = 'portfolios:term';
    const [term, setTerm] = useState<Term>(
        () => ((globalThis.window !== undefined && (localStorage.getItem(TERM_KEY) as Term)) || 'first'),
    );
    const selectTerm = (v: string) => {
        if (!v) return;
        setTerm(v as Term);
        if (globalThis.window !== undefined) localStorage.setItem(TERM_KEY, v);
    };

    // صفوف الفصل المختار: كل منسق + تقييمه في هذا الفصل (إن وُجد)
    const rows = useMemo<Row[]>(
        () =>
            coordinators.map((c) => {
                const review = reviews.find((r) => r.teacher_id === c.teacher_id && r.term === term) ?? null;
                return {
                    teacher_id: c.teacher_id,
                    name: c.name,
                    school: c.school ?? '—',
                    gender: c.gender,
                    department: c.department ?? '—',
                    // الموجّه المنفّذ للتقييم إن وُجد، وإلا الموجّه المسؤول عن المدرسة
                    supervisor: review?.supervisor?.name ?? c.supervisor ?? '—',
                    review,
                };
            }),
        [coordinators, reviews, term],
    );

    const stats = useMemo(() => {
        const evaluated = rows.filter((r) => r.review).length;
        const finals = rows.filter((r) => r.review?.status === 'final').length;
        return { total: rows.length, evaluated, finals, remaining: rows.length - evaluated };
    }, [rows]);

    const start = (teacherId: number) => {
        if (starting) return;
        setStarting(true);
        router.post(
            '/portfolios',
            { teacher_id: teacherId, term },
            {
                onFinish: () => setStarting(false),
                onError: (e) => toast.error(Object.values(e)[0] ?? 'تعذّر بدء التقييم'),
            },
        );
    };

    const statusBadge = (r: Row) => {
        if (!r.review) return <Badge variant="outline">لم يبدأ</Badge>;
        return r.review.status === 'final' ? <Badge>معتمد</Badge> : <Badge variant="secondary">مسودة</Badge>;
    };

    const columns: ColumnDef<Row>[] = [
        {
            id: 'coordinator',
            accessorFn: (r) => r.name,
            header: 'المنسق',
            cell: ({ row }) =>
                row.original.review ? (
                    <Link href={`/portfolios/${row.original.review.id}`} className="font-medium hover:underline">
                        {row.original.name}
                    </Link>
                ) : (
                    <span className="font-medium">{row.original.name}</span>
                ),
        },
        { id: 'school', accessorFn: (r) => r.school, header: 'المدرسة', cell: ({ row }) => row.original.school },
        { id: 'department', accessorFn: (r) => r.department, header: 'المادة', cell: ({ row }) => row.original.department },
        { id: 'supervisor', accessorFn: (r) => r.supervisor, header: 'الموجّه', cell: ({ row }) => row.original.supervisor },
        {
            id: 'score',
            header: 'الدرجة',
            cell: ({ row }) =>
                row.original.review?.total_score != null ? (
                    <span className="tnum">
                        {row.original.review.total_score}
                        {row.original.review.result && <span className="text-muted-foreground"> · {row.original.review.result}</span>}
                    </span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        { id: 'status', header: 'الحالة', cell: ({ row }) => statusBadge(row.original) },
        {
            id: 'date',
            header: 'التاريخ',
            cell: ({ row }) => <span className="tnum text-sm">{formatDate(row.original.review?.reviewed_at)}</span>,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const r = row.original;
                if (!canCreate) return null;
                if (r.review) {
                    return (
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={`/portfolios/${r.review.id}`}>فتح</Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleting(r.review)} aria-label="حذف">
                                <Trash2 className="text-destructive size-4" />
                            </Button>
                        </div>
                    );
                }
                return (
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" disabled={!hasTemplate || starting} onClick={() => start(r.teacher_id)}>
                            <Play className="size-4" /> بدء التقييم
                        </Button>
                    </div>
                );
            },
        },
    ];

    // أنواع المدارس الموجودة فعلًا (بنين/بنات) — يظهر التاب فقط عند وجود أكثر من نوع (مفيد لرئيس القسم)
    const genders = Array.from(new Set(coordinators.map((c) => c.gender).filter((g): g is 'boys' | 'girls' | 'mixed' => !!g)));

    const filters: DataTableFilter<Row>[] = [
        ...(genders.length > 1
            ? [
                  {
                      id: 'gender',
                      label: 'النوع',
                      variant: 'tabs' as const,
                      options: genders.map((g) => ({ value: g, label: GENDER_LABEL[g] })),
                      getValue: (r: Row) => r.gender ?? '',
                  },
              ]
            : []),
        {
            id: 'status',
            label: 'الحالة',
            variant: 'tabs',
            options: [
                { value: 'final', label: 'معتمد' },
                { value: 'draft', label: 'مسودة' },
                { value: 'none', label: 'لم يبدأ' },
            ],
            getValue: (r) => (r.review ? r.review.status : 'none'),
        },
    ];

    const renderCard = (r: Row) => (
        <Card className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    {r.review ? (
                        <Link href={`/portfolios/${r.review.id}`} className="truncate font-semibold hover:underline">
                            {r.name}
                        </Link>
                    ) : (
                        <p className="truncate font-semibold">{r.name}</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                        {r.school}
                        {r.gender && ` (${GENDER_LABEL[r.gender]})`} · {r.department}
                    </p>
                    <p className="text-muted-foreground text-xs">الموجّه: {r.supervisor}</p>
                </div>
                {statusBadge(r)}
            </div>

            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">{formatDate(r.review?.reviewed_at)}</span>
                {r.review?.total_score != null ? (
                    <span className="tnum font-medium">
                        {r.review.total_score}
                        {r.review.result && <span className="text-muted-foreground"> · {r.review.result}</span>}
                    </span>
                ) : (
                    <span className="text-muted-foreground tnum">—</span>
                )}
            </div>

            {canCreate &&
                (r.review ? (
                    <Button variant="outline" size="sm" className="mt-auto" asChild>
                        <Link href={`/portfolios/${r.review.id}`}>فتح السجل</Link>
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="mt-auto" disabled={!hasTemplate || starting} onClick={() => start(r.teacher_id)}>
                        <Play className="size-4" /> بدء التقييم
                    </Button>
                ))}
        </Card>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={pageTitle} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {supervisor && canDrillSupervisors && <DrilldownBack href={backHref} label="رجوع إلى الموجهين" />}
                <PageHeader title={pageTitle} description="تقييم حافظة أعمال المنسّقين — مرتان سنويًا (الفصلان)" />

                {!hasTemplate && (
                    <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        لا يوجد قالب تقييم فعّال — أضِف قالبًا من{' '}
                        <Link href="/portfolio-templates" className="font-semibold underline">
                            إعدادات قوالب تقييم الملفات
                        </Link>{' '}
                        قبل البدء.
                    </Card>
                )}

                {/* تابات الفصل — التقييم مرتان سنويًا */}
                <ToggleGroup type="single" dir="rtl" value={term} onValueChange={selectTerm} className="justify-start gap-1">
                    {TERMS.map((t) => (
                        <ToggleGroupItem
                            key={t.value}
                            value={t.value}
                            className="border-border/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg border px-5"
                        >
                            {t.label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>

                <div className="grid gap-4 lg:grid-cols-3">
                    {/* مخطّط نسبة الإنجاز للفصل المختار */}
                    <GaugeCard
                        title={`نسبة الإنجاز — ${TERMS.find((t) => t.value === term)?.label}`}
                        hint={`${stats.evaluated} من ${stats.total} منسق`}
                        className="lg:col-span-1"
                        items={[
                            {
                                pct: stats.total ? (stats.evaluated / stats.total) * 100 : 0,
                                label: 'تم التقييم',
                                sub: `${stats.evaluated}/${stats.total}`,
                                color: '#8D1B3D',
                            },
                            {
                                pct: stats.total ? (stats.finals / stats.total) * 100 : 0,
                                label: 'معتمد',
                                sub: `${stats.finals}/${stats.total}`,
                                color: '#22C55E',
                            },
                        ]}
                    />

                    <div className="grid content-start gap-4 sm:grid-cols-3 lg:col-span-2">
                        <StatCard title="إجمالي المنسّقين" value={stats.total} icon={FolderCheck} tone="primary" />
                        <StatCard title="تم تقييمهم" value={stats.evaluated} icon={CheckCircle2} tone="success" />
                        <StatCard title="لم يبدأ" value={stats.remaining} icon={FileText} tone="warning" />
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={rows}
                    searchPlaceholder="ابحث باسم المنسق..."
                    emptyMessage="لا يوجد منسّقون مسؤول عنهم"
                    filters={filters}
                    renderCard={renderCard}
                    storageKey="view:portfolios"
                />
            </div>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف سجل التقييم"
                description="سيتم حذف السجل وبنوده ومرفقاته. لا يمكن التراجع."
                onConfirm={() =>
                    deleting &&
                    router.delete(`/portfolios/${deleting.id}`, {
                        onSuccess: () => {
                            setDeleting(null);
                            toast.success('تم الحذف');
                        },
                    })
                }
            />
        </AppLayout>
    );
}

/** إجمالي إحصاءات البطاقات للبطاقات العلوية في مستويَي الأقسام/الموجهين. */
function BoardStatRow({ items }: Readonly<{ items: Stats[] }>) {
    const totals = aggregate(items);
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="نسبة التقييم الكلية" value={`${totals.completion}%`} icon={ClipboardList} tone="primary" hint={`${totals.total} منسق`} />
            <StatCard title="تم تقييمهم" value={totals.done} icon={CheckCircle2} tone="success" />
            <StatCard title="لم يُقيَّموا" value={totals.remaining} icon={Clock} tone="warning" />
            <StatCard title="متأخر" value={totals.late} icon={AlertTriangle} tone="destructive" />
        </div>
    );
}

/* ===================== التبديل بين المستويات ===================== */
export default function PortfoliosIndex(props: Readonly<PageProps>) {
    const [genderTab, setGenderTab] = useState<GenderTab>('all');

    /* مستوى الأقسام */
    if (props.view === 'departments') {
        const departments = props.departments ?? [];
        const breadcrumbs: BreadcrumbItem[] = [
            { title: 'لوحة التحكم', href: '/dashboard' },
            { title: 'تقييم ملفات المنسق', href: '/portfolios' },
        ];
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="تقييم ملفات المنسق — الأقسام" />
                <div className="flex flex-col gap-6 p-4 md:p-6">
                    <PageHeader title="تقييم ملفات المنسق" description="اختر القسم لعرض موجّهيه ونِسب تقييم منسّقيهم" />
                    <BoardStatRow items={departments} />
                    {departments.length === 0 ? (
                        <Card className="text-muted-foreground p-8 text-center">لا توجد أقسام</Card>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {departments.map((d) => (
                                <BoardCard key={d.id} href={`/portfolios?department=${d.id}`} name={d.name} icon={Building2} stats={d} />
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
            { title: 'تقييم ملفات المنسق', href: '/portfolios' },
            { title: department?.name ?? 'القسم', href: '#' },
        ];
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`تقييم ملفات المنسق — ${department?.name ?? 'الموجهون'}`} />
                <div className="flex flex-col gap-6 p-4 md:p-6">
                    {props.canDrillDepartments && <DrilldownBack href="/portfolios" label="رجوع إلى الأقسام" />}
                    <PageHeader title={department?.name ?? 'الموجهون'} description="اختر الموجّه لعرض تقييم ملفات منسّقيه" />
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
                                    href={`/portfolios?supervisor=${s.id}`}
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

    /* مستوى المحتوى */
    return (
        <ContentLevel
            coordinators={props.coordinators ?? []}
            reviews={props.reviews ?? []}
            hasTemplate={props.hasTemplate ?? false}
            supervisor={props.supervisor}
            department={props.department}
            canDrillSupervisors={props.canDrillSupervisors}
        />
    );
}
