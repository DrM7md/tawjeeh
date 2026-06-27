import { usePermissions } from '@/components/shared/can';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
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
import { EXAM_PERIODS, examPeriodShort } from '@/lib/exam-periods';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type Grade } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import {
    BarChart3,
    Building2,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ClipboardCheck,
    ClipboardList,
    Clock,
    FileText,
    Plus,
    School,
    Trash2,
    UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'تحكيم الاختبارات', href: '/reviews' },
];

const genderLabels: Record<string, string> = { boys: 'بنين', girls: 'بنات', mixed: 'مشترك' };

interface Review {
    id: number;
    status: 'draft' | 'final';
    exam_period: string | null;
    reviewed_at: string | null;
    school?: { id: number; name: string; gender?: string | null };
    department?: { name: string };
    stage?: { name: string };
    grade?: { name: string } | null;
    track?: { name: string } | null;
    preparer?: { name: string } | null;
    supervisor?: { name: string };
    form?: { total_score: string | number } | null;
}
interface Opt {
    id: number;
    name: string;
}
interface SchoolOpt extends Opt {
    stage_id: number | null;
    stage?: { id: number; name: string } | null;
}
interface TeacherOpt extends Opt {
    school_id: number | null;
    department_id: number | null;
}
/** مؤشّر تغطية اختبار واحد: المدارس المعتمدة ÷ إجمالي المدارس. */
interface PerExam {
    exam: string;
    done: number;
    expected: number;
    completion: number;
}
/** إحصائيات التغطية المشتركة للبطاقات (قسم/موجّه). */
interface CoverageStats {
    schools: number;
    expected: number;
    done: number;
    remaining: number;
    total: number;
    final: number;
    completion: number;
    per_exam: PerExam[];
}
interface DeptBoard extends CoverageStats {
    id: number;
    name: string;
    supervisors: number;
}
type SupBoard = CoverageStats & Opt;
interface SelectedSupervisor extends Opt {
    department_id: number | null;
}
interface PageProps {
    /** مستوى العرض: الأقسام ← الموجهون ← التحكيمات. */
    mode?: 'departments' | 'supervisors' | 'reviews';
    // مستوى الأقسام
    departments?: Opt[] | DeptBoard[];
    // مستوى الموجهين
    department?: Opt | null;
    supervisors?: SupBoard[];
    canDrillDepartments?: boolean;
    // مستوى التحكيمات
    selectedSupervisor?: SelectedSupervisor | null;
    reviews: Review[];
    schools: SchoolOpt[];
    grades: Grade[];
    teachers: TeacherOpt[];
    userDepartment: Opt | null;
}

/** مجموعة تحكيمات لنفس (المدرسة + الاختبار) — تُعرض كبطاقة واحدة تضمّ صفوفها. */
interface ReviewGroup {
    key: string;
    schoolId: number | null;
    schoolName: string;
    schoolGender: string | null;
    exam_period: string | null;
    departmentName: string;
    stageName: string;
    items: Review[];
    statuses: string[];
}

export default function ReviewsPage(props: Readonly<PageProps>) {
    if (props.mode === 'departments') {
        return <DepartmentsBoard departments={(props.departments as DeptBoard[]) ?? []} />;
    }
    if (props.mode === 'supervisors') {
        return (
            <SupervisorsBoard
                department={props.department ?? null}
                supervisors={props.supervisors ?? []}
                canDrillDepartments={props.canDrillDepartments ?? false}
            />
        );
    }
    return <ReviewsIndex {...props} />;
}

function completionTone(pct: number): { bar: string; text: string } {
    if (pct >= 80) return { bar: 'bg-success', text: 'text-success' };
    if (pct >= 50) return { bar: 'bg-warning', text: 'text-warning' };
    return { bar: 'bg-destructive', text: 'text-destructive' };
}

/** بطاقة قسم/موجّه: الاسم + نسبة التغطية + شريط تقدّم + مؤشّر لكل اختبار + ملخّص. قابلة للنقر. */
function BoardCard({
    href,
    name,
    icon: Icon,
    subtitle,
    completion,
    perExam,
    cells,
}: Readonly<{
    href: string;
    name: string;
    icon: typeof Building2;
    subtitle?: string;
    completion: number;
    perExam: PerExam[];
    cells: { label: string; value: number; className?: string }[];
}>) {
    const tone = completionTone(completion);

    return (
        <Link href={href} className="group">
            <Card className="hover-lift group-hover:border-primary/50 flex h-full flex-col gap-4 p-5 transition-colors">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                            <Icon className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate font-semibold">{name}</p>
                            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
                        </div>
                    </div>
                    <ChevronLeft className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground text-xs">نسبة الإنجاز</span>
                        <span className={cn('tnum text-lg font-bold', tone.text)}>{completion}%</span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                        <div className={cn('h-full rounded-full transition-all', tone.bar)} style={{ width: `${completion}%` }} />
                    </div>
                </div>

                {/* مؤشّر لكل اختبار من الاختبارات الأربعة */}
                <div className="space-y-1.5">
                    {perExam.map((pe) => {
                        const t = completionTone(pe.completion);
                        return (
                            <div key={pe.exam} className="flex items-center gap-2">
                                <span className="text-muted-foreground w-20 shrink-0 truncate text-[11px]">{examPeriodShort(pe.exam)}</span>
                                <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                                    <div className={cn('h-full rounded-full transition-all', t.bar)} style={{ width: `${pe.completion}%` }} />
                                </div>
                                <span className="text-muted-foreground tnum w-10 shrink-0 text-left text-[11px]">
                                    {pe.done}/{pe.expected}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <dl
                    className={cn(
                        'text-muted-foreground border-border/60 grid gap-2 border-t pt-3 text-center text-xs',
                        cells.length === 4 ? 'grid-cols-4' : 'grid-cols-3',
                    )}
                >
                    {cells.map((c) => (
                        <div key={c.label}>
                            <dt className={c.className}>{c.label}</dt>
                            <dd className="text-foreground tnum font-semibold">{c.value}</dd>
                        </div>
                    ))}
                </dl>
            </Card>
        </Link>
    );
}

function aggregateCoverage(items: CoverageStats[]) {
    const sum = (k: 'expected' | 'done' | 'remaining' | 'total' | 'final') => items.reduce((a, b) => a + b[k], 0);
    const expected = sum('expected');
    const done = sum('done');
    return {
        expected,
        done,
        remaining: sum('remaining'),
        total: sum('total'),
        final: sum('final'),
        completion: expected ? Math.round((done / expected) * 1000) / 10 : 0,
    };
}

/** المستوى الأول (رئيس التوجيه): بطاقات الأقسام مع نِسب التغطية. */
function DepartmentsBoard({ departments }: Readonly<{ departments: DeptBoard[] }>) {
    const totals = aggregateCoverage(departments);
    const crumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'تحكيم الاختبارات', href: '/reviews' },
    ];

    return (
        <AppLayout breadcrumbs={crumbs}>
            <Head title="تحكيم الاختبارات — الأقسام" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="تحكيم الاختبارات" description="اختر القسم لعرض موجّهيه ونِسب إنجاز التحكيم" />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="نسبة الإنجاز الكلية"
                        value={`${totals.completion}%`}
                        icon={ClipboardList}
                        tone="primary"
                        hint={`${totals.done}/${totals.expected} خانة معتمدة`}
                    />
                    <StatCard title="خانات معتمدة" value={totals.done} icon={CheckCircle2} tone="success" />
                    <StatCard title="متبقّي" value={totals.remaining} icon={Clock} tone="warning" />
                    <StatCard title="إجمالي التحكيمات" value={totals.total} icon={ClipboardCheck} tone="info" />
                </div>

                {departments.length === 0 ? (
                    <Card className="text-muted-foreground p-8 text-center">لا توجد أقسام</Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {departments.map((d) => (
                            <BoardCard
                                key={d.id}
                                href={`/reviews?department=${d.id}`}
                                name={d.name}
                                icon={Building2}
                                subtitle={`${d.supervisors} موجّه · ${d.schools} مدرسة`}
                                completion={d.completion}
                                perExam={d.per_exam}
                                cells={[
                                    { label: 'مكتمل', value: d.done, className: 'text-success' },
                                    { label: 'متبقّي', value: d.remaining, className: 'text-warning' },
                                    { label: 'معتمدة', value: d.final },
                                    { label: 'الكل', value: d.total },
                                ]}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

/** المستوى الثاني (رئيس القسم/التوجيه): بطاقات الموجهين مع نِسب التغطية. */
function SupervisorsBoard({
    department,
    supervisors,
    canDrillDepartments,
}: Readonly<{ department: Opt | null; supervisors: SupBoard[]; canDrillDepartments: boolean }>) {
    const totals = aggregateCoverage(supervisors);
    const crumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'تحكيم الاختبارات', href: '/reviews' },
        { title: department?.name ?? 'القسم', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={crumbs}>
            <Head title={`تحكيم الاختبارات — ${department?.name ?? 'الموجّهون'}`} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {canDrillDepartments && (
                    <Button variant="ghost" size="sm" className="-mb-2 w-fit" asChild>
                        <Link href="/reviews">
                            <ChevronLeft className="size-4 rotate-180" /> رجوع إلى الأقسام
                        </Link>
                    </Button>
                )}
                <PageHeader title={department?.name ?? 'الموجّهون'} description="اختر الموجّه لعرض تحكيماته ونسبة إنجازه" />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="نسبة إنجاز القسم"
                        value={`${totals.completion}%`}
                        icon={ClipboardList}
                        tone="primary"
                        hint={`${supervisors.length} موجّه`}
                    />
                    <StatCard title="خانات معتمدة" value={totals.done} icon={CheckCircle2} tone="success" />
                    <StatCard title="متبقّي" value={totals.remaining} icon={Clock} tone="warning" />
                    <StatCard title="إجمالي التحكيمات" value={totals.total} icon={ClipboardCheck} tone="info" />
                </div>

                {supervisors.length === 0 ? (
                    <Card className="text-muted-foreground p-8 text-center">لا يوجد موجّهون في هذا القسم</Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {supervisors.map((s) => (
                            <BoardCard
                                key={s.id}
                                href={`/reviews?supervisor=${s.id}`}
                                name={s.name}
                                icon={UserRound}
                                subtitle={`${s.schools} مدرسة مكلّف بها`}
                                completion={s.completion}
                                perExam={s.per_exam}
                                cells={[
                                    { label: 'مكتمل', value: s.done, className: 'text-success' },
                                    { label: 'متبقّي', value: s.remaining, className: 'text-warning' },
                                    { label: 'معتمدة', value: s.final },
                                    { label: 'الكل', value: s.total },
                                ]}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function ReviewsIndex({ reviews, schools, grades, teachers, userDepartment, departments = [], selectedSupervisor, canDrillDepartments }: PageProps) {
    const { can } = usePermissions();
    const canCreate = can('reviews.create');

    // الرجوع: إلى موجّهي القسم لرئيس التوجيه (مع تمرير القسم)، وإلى /reviews لرئيس القسم.
    const backHref = selectedSupervisor
        ? canDrillDepartments && selectedSupervisor.department_id
            ? `/reviews?department=${selectedSupervisor.department_id}`
            : '/reviews'
        : undefined;
    const reviewsCrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'تحكيم الاختبارات', href: '/reviews' },
        ...(selectedSupervisor ? [{ title: selectedSupervisor.name, href: '#' }] : []),
    ];

    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<Review | null>(null);

    // فتح/إغلاق قائمة المدارس المتبقّية مع حفظ آخر حالة في المتصفح
    const REMAINING_KEY = 'reviews:remaining-open';
    const [showRemaining, setShowRemaining] = useState(() => globalThis.window !== undefined && localStorage.getItem(REMAINING_KEY) === '1');
    const toggleRemaining = () => {
        setShowRemaining((prev) => {
            const next = !prev;
            if (globalThis.window !== undefined) localStorage.setItem(REMAINING_KEY, next ? '1' : '0');
            return next;
        });
    };
    // التاب المختار في لوحة المتابعة (أي اختبار) — يُحفظ آخر اختيار
    const EXAM_TAB_KEY = 'reviews:exam-tab';
    const [examTab, setExamTab] = useState(() => (globalThis.window !== undefined && localStorage.getItem(EXAM_TAB_KEY)) || EXAM_PERIODS[0].value);
    const selectExamTab = (v: string) => {
        if (!v) return;
        setExamTab(v);
        if (globalThis.window !== undefined) localStorage.setItem(EXAM_TAB_KEY, v);
    };

    const form = useForm({
        school_id: '',
        department_id: '',
        grade_id: '',
        grade_track_id: '',
        preparer_id: '',
        exam_period: '',
        reviewed_at: new Date().toISOString().slice(0, 10),
    });

    // المدرسة المختارة تُحدّد المرحلة، والمرحلة تُصفّي الصفوف
    const selectedSchool = schools.find((s) => String(s.id) === form.data.school_id);
    const stageName = selectedSchool?.stage?.name ?? null;
    const gradeItems = useMemo(
        () =>
            grades
                .filter((g) => g.stage_id == null || g.stage_id === (selectedSchool?.stage_id ?? -1))
                .map((g) => ({ value: String(g.id), label: g.name })),
        [grades, selectedSchool],
    );
    const selectedGrade = grades.find((g) => String(g.id) === form.data.grade_id);
    const tracks = selectedGrade?.tracks ?? [];

    const setSchool = (v: string) => {
        form.setData((data) => ({ ...data, school_id: v, grade_id: '', grade_track_id: '', preparer_id: '' }));
    };
    const setGrade = (v: string) => {
        form.setData((data) => ({ ...data, grade_id: v, grade_track_id: '' }));
    };

    // معد الاختبار: معلمو المدرسة المختارة ضمن نفس المادة (قسم الموجّه أو المادة المختارة)
    const effectiveDeptId = userDepartment ? String(userDepartment.id) : form.data.department_id;
    const teacherItems = useMemo(
        () =>
            teachers
                .filter((t) => String(t.school_id) === form.data.school_id && (!effectiveDeptId || String(t.department_id) === effectiveDeptId))
                .map((t) => ({ value: String(t.id), label: t.name })),
        [teachers, form.data.school_id, effectiveDeptId],
    );

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/reviews', {
            onSuccess: () => {
                setOpen(false);
                toast.success('تم إنشاء سجل التحكيم');
            },
        });
    };

    const stats = {
        total: reviews.length,
        final: reviews.filter((r) => r.status === 'final').length,
        draft: reviews.filter((r) => r.status === 'draft').length,
    };

    const openCreate = (schoolId?: number, examPeriod?: string) => {
        form.clearErrors();
        if (schoolId) setSchool(String(schoolId));
        if (examPeriod) form.setData('exam_period', examPeriod);
        setOpen(true);
    };

    /**
     * متابعة اعتماد المدارس لكل اختبار من الاختبارات الأربعة.
     * لكل مدرسة + اختبار: «معتمد» = تحكيم معتمد واحد على الأقل بلا مسودة معلّقة،
     * «قيد العمل» = لديه مسودة، «لم يبدأ» = لا تحكيم. والمدرسة «مكتملة» = اعتُمدت اختباراتها الأربعة.
     */
    const approval = useMemo(() => {
        const map = new Map<number, Record<string, { final: number; draft: number }>>();
        for (const r of reviews) {
            const sid = r.school?.id;
            const ep = r.exam_period;
            if (!sid || !ep) continue;
            const m = map.get(sid) ?? {};
            const e = m[ep] ?? { final: 0, draft: 0 };
            if (r.status === 'final') e.final += 1;
            else e.draft += 1;
            m[ep] = e;
            map.set(sid, m);
        }
        const stateOf = (sid: number, ep: string): 'approved' | 'in_progress' | 'not_started' => {
            const e = map.get(sid)?.[ep];
            if (!e) return 'not_started';
            return e.draft === 0 && e.final > 0 ? 'approved' : 'in_progress';
        };
        const perExam = EXAM_PERIODS.map((ep) => {
            const approved: SchoolOpt[] = [];
            const inProgress: SchoolOpt[] = [];
            const notStarted: SchoolOpt[] = [];
            for (const s of schools) {
                const st = stateOf(s.id, ep.value);
                if (st === 'approved') approved.push(s);
                else if (st === 'in_progress') inProgress.push(s);
                else notStarted.push(s);
            }
            return { ...ep, approved, inProgress, notStarted, remaining: inProgress.length + notStarted.length };
        });
        const total = schools.length;
        const complete = schools.filter((s) => EXAM_PERIODS.every((ep) => stateOf(s.id, ep.value) === 'approved')).length;
        return { perExam, total, complete };
    }, [schools, reviews]);

    const activeExam = approval.perExam.find((e) => e.value === examTab) ?? approval.perExam[0];
    const examPct = approval.total ? Math.round((activeExam.approved.length / approval.total) * 100) : 0;

    // نسبة الإنجاز (التغطية): خانات (مدرسة + اختبار) المعتمدة ÷ (المدارس × 4 اختبارات)
    const approvedSlots = approval.perExam.reduce((sum, e) => sum + e.approved.length, 0);
    const coveragePct = approval.total ? Math.round((approvedSlots / (approval.total * EXAM_PERIODS.length)) * 100) : 0;

    // تجميع التحكيمات حسب (المدرسة + الاختبار) — بطاقة واحدة لكل مجموعة تضمّ صفوفها
    const groups = useMemo<ReviewGroup[]>(() => {
        const map = new Map<string, ReviewGroup>();
        for (const r of reviews) {
            const key = `${r.school?.id ?? 0}|${r.exam_period ?? ''}`;
            let g = map.get(key);
            if (!g) {
                g = {
                    key,
                    schoolId: r.school?.id ?? null,
                    schoolName: r.school?.name ?? '—',
                    schoolGender: r.school?.gender ?? null,
                    exam_period: r.exam_period,
                    departmentName: r.department?.name ?? '—',
                    stageName: r.stage?.name ?? '—',
                    items: [],
                    statuses: [],
                };
                map.set(key, g);
            }
            g.items.push(r);
        }
        for (const g of map.values()) {
            // الأحدث أولًا داخل البطاقة
            g.items.sort((a, b) => (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? ''));
            g.statuses = g.items.map((i) => i.status);
        }
        return [...map.values()];
    }, [reviews]);

    const gradeLabel = (r: Review) => (r.grade?.name ? [r.grade.name, r.track?.name].filter(Boolean).join(' — ') : '—');

    const columns: ColumnDef<ReviewGroup>[] = [
        {
            id: 'school',
            accessorFn: (g) => g.schoolName,
            header: 'المدرسة',
            cell: ({ row }) => (
                <span className="font-medium">
                    {row.original.schoolName}
                    {row.original.schoolGender && (
                        <span className="text-muted-foreground font-normal">
                            {' '}
                            ({genderLabels[row.original.schoolGender] ?? row.original.schoolGender})
                        </span>
                    )}
                </span>
            ),
        },
        {
            id: 'exam',
            header: 'الاختبار',
            cell: ({ row }) =>
                row.original.exam_period ? (
                    <Badge variant="outline">{examPeriodShort(row.original.exam_period)}</Badge>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        { id: 'department', header: 'المادة', cell: ({ row }) => row.original.departmentName },
        { id: 'stage', header: 'المرحلة', cell: ({ row }) => row.original.stageName },
        {
            id: 'grades',
            header: 'الصفوف',
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.items.map((it) => (
                        <Link key={it.id} href={`/reviews/${it.id}`}>
                            <Badge variant={it.status === 'final' ? 'default' : 'secondary'} className="cursor-pointer">
                                {gradeLabel(it)}
                                {it.form?.total_score != null && <span className="tnum opacity-70"> · {it.form.total_score}</span>}
                            </Badge>
                        </Link>
                    ))}
                </div>
            ),
        },
        {
            id: 'status',
            header: 'المعتمد',
            cell: ({ row }) => {
                const finals = row.original.statuses.filter((s) => s === 'final').length;
                return (
                    <span className="tnum text-sm">
                        {finals}/{row.original.items.length}
                    </span>
                );
            },
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) =>
                canCreate && (
                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCreate(row.original.schoolId ?? undefined, row.original.exam_period ?? undefined)}
                        >
                            <Plus className="size-4" /> صف
                        </Button>
                    </div>
                ),
        },
    ];

    // أنواع المدارس الموجودة فعليًا في بيانات المستخدم — تاب النوع يظهر فقط عند وجود أكثر من نوع
    const genderValues = Array.from(new Set(groups.map((g) => g.schoolGender).filter((v): v is string => !!v)));
    const stageNames = Array.from(new Set(reviews.map((r) => r.stage?.name).filter(Boolean))) as string[];
    const reviewSchools = [...new Set(reviews.map((r) => r.school?.name).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'ar'));
    const filters: DataTableFilter<ReviewGroup>[] = [
        {
            id: 'exam',
            label: 'الاختبار',
            variant: 'tabs',
            options: EXAM_PERIODS.map((e) => ({ value: e.value, label: e.label })),
            getValue: (g) => g.exam_period ?? '',
        },
        {
            id: 'status',
            label: 'الحالة',
            variant: 'tabs',
            options: [
                { value: 'final', label: 'معتمد' },
                { value: 'draft', label: 'مسودة' },
            ],
            // المجموعة تطابق إن احتوت على صفّ بهذه الحالة
            getValue: (g) => g.statuses,
        },
        // تاب بنين/بنات — يظهر تلقائيًا فقط عند وجود أكثر من نوع في بيانات المستخدم
        ...(genderValues.length > 1
            ? [
                  {
                      id: 'gender',
                      label: 'النوع',
                      variant: 'tabs' as const,
                      options: genderValues.map((v) => ({ value: v, label: genderLabels[v] ?? v })),
                      getValue: (g: ReviewGroup) => g.schoolGender ?? '',
                  },
              ]
            : []),
        ...(reviewSchools.length > 1
            ? [
                  {
                      id: 'school',
                      label: 'المدرسة',
                      variant: 'search' as const,
                      options: reviewSchools.map((s) => ({ value: s, label: s })),
                      getValue: (g: ReviewGroup) => g.schoolName,
                  },
              ]
            : []),
        {
            id: 'department',
            label: 'المادة',
            options: departments.map((d) => ({ value: d.name, label: d.name })),
            getValue: (g) => g.departmentName,
        },
        ...(stageNames.length
            ? [
                  {
                      id: 'stage',
                      label: 'المرحلة',
                      options: stageNames.map((n) => ({ value: n, label: n })),
                      getValue: (g: ReviewGroup) => g.stageName,
                  },
              ]
            : []),
    ];

    const renderCard = (g: ReviewGroup) => {
        const finals = g.statuses.filter((s) => s === 'final').length;
        const allFinal = finals === g.items.length;
        return (
            <Card className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="truncate font-semibold">
                            {g.schoolName}
                            {g.schoolGender && (
                                <span className="text-muted-foreground font-normal"> ({genderLabels[g.schoolGender] ?? g.schoolGender})</span>
                            )}
                        </p>
                        <p className="text-muted-foreground text-xs">
                            {g.departmentName} · {g.stageName}
                        </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                        {examPeriodShort(g.exam_period)}
                    </Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{g.items.length} صف</span>
                    <span className={cn('tnum font-medium', allFinal ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                        {finals}/{g.items.length} معتمد
                    </span>
                </div>

                <ul className="divide-border/60 border-border/60 divide-y rounded-xl border">
                    {g.items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-2 p-2.5">
                            <Link href={`/reviews/${it.id}`} className="min-w-0 flex-1 hover:underline">
                                <span className="block truncate text-sm font-medium">{gradeLabel(it)}</span>
                                {it.preparer?.name && (
                                    <span className="text-muted-foreground block truncate text-xs">معد الاختبار: {it.preparer.name}</span>
                                )}
                            </Link>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className="text-muted-foreground tnum text-xs">{it.form?.total_score ?? '—'}</span>
                                <Badge variant={it.status === 'final' ? 'default' : 'secondary'} className="px-1.5 text-[10px]">
                                    {it.status === 'final' ? 'معتمد' : 'مسودة'}
                                </Badge>
                                {canCreate && (
                                    <button type="button" onClick={() => setDeleting(it)} aria-label="حذف">
                                        <Trash2 className="text-destructive size-3.5" />
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                {canCreate && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-auto"
                        onClick={() => openCreate(g.schoolId ?? undefined, g.exam_period ?? undefined)}
                    >
                        <Plus className="size-4" /> أضف صفًا
                    </Button>
                )}
            </Card>
        );
    };

    return (
        <AppLayout breadcrumbs={reviewsCrumbs}>
            <Head title="تحكيم الاختبارات" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={selectedSupervisor ? `تحكيمات: ${selectedSupervisor.name}` : 'تحكيم الاختبارات'}
                    description={
                        selectedSupervisor
                            ? 'سجلات تحكيم هذا الموجّه — الاختبارات الأربعة'
                            : 'سجلات تحكيم الاختبارات حسب العام المختار — الاختبارات الأربعة'
                    }
                    backHref={backHref}
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" asChild>
                                <Link href="/reviews-statistics">
                                    <BarChart3 className="size-4" /> إحصائيات
                                </Link>
                            </Button>
                            {canCreate && (
                                <Button onClick={() => openCreate()}>
                                    <Plus className="size-4" /> تحكيم جديد
                                </Button>
                            )}
                        </div>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="نسبة الإنجاز"
                        value={`${coveragePct}%`}
                        icon={ClipboardList}
                        tone="primary"
                        hint={`${approval.complete}/${approval.total} مدرسة مكتملة`}
                    />
                    <StatCard title="إجمالي التحكيمات" value={stats.total} icon={ClipboardCheck} tone="info" />
                    <StatCard title="معتمدة" value={stats.final} icon={CheckCircle2} tone="success" />
                    <StatCard title="مسودات" value={stats.draft} icon={FileText} tone="warning" />
                </div>

                {/* متابعة اعتماد المدارس لكل اختبار من الاختبارات الأربعة */}
                {approval.total > 0 && (
                    <Card className="space-y-4 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <School className="text-primary size-5" />
                                <h2 className="font-semibold">متابعة اعتماد المدارس</h2>
                            </div>
                            <span className="text-sm">
                                <span className="text-primary tnum font-bold">{approval.complete}</span>
                                <span className="text-muted-foreground"> / {approval.total} مدرسة مكتملة (الاختبارات الأربعة)</span>
                            </span>
                        </div>

                        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                            <div
                                className="bg-primary h-full rounded-full transition-all"
                                style={{ width: `${approval.total ? Math.round((approval.complete / approval.total) * 100) : 0}%` }}
                            />
                        </div>

                        {/* تابات الاختبارات — كل تاب يعرض كم مدرسة اعتمدت ذلك الاختبار */}
                        <ToggleGroup
                            type="single"
                            size="sm"
                            dir="rtl"
                            value={examTab}
                            onValueChange={selectExamTab}
                            className="flex-wrap justify-start gap-1"
                        >
                            {approval.perExam.map((ex) => (
                                <ToggleGroupItem
                                    key={ex.value}
                                    value={ex.value}
                                    className="border-border/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 rounded-lg border px-3"
                                >
                                    {ex.label}
                                    <span className="tnum text-xs opacity-70">
                                        {ex.approved.length}/{approval.total}
                                    </span>
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>

                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${examPct}%` }} />
                        </div>

                        {activeExam.remaining === 0 ? (
                            <p className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-4" /> تم اعتماد «{activeExam.full}» لجميع المدارس.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={toggleRemaining}
                                    aria-expanded={showRemaining}
                                    className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 text-sm transition-colors"
                                >
                                    <span>
                                        متبقّي <span className="text-foreground tnum font-semibold">{activeExam.remaining}</span> مدرسة على اعتماد «
                                        {activeExam.label}»
                                    </span>
                                    <ChevronDown className={cn('size-4 shrink-0 transition-transform', showRemaining && 'rotate-180')} />
                                </button>

                                {showRemaining && (
                                    <div className="space-y-3">
                                        {activeExam.inProgress.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-muted-foreground text-xs">
                                                    بها مسودات بانتظار الاعتماد ({activeExam.inProgress.length})
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {activeExam.inProgress.map((s) => (
                                                        <Badge
                                                            key={s.id}
                                                            variant="secondary"
                                                            className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                                        >
                                                            {s.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {activeExam.notStarted.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-muted-foreground text-xs">
                                                    لم يبدأ تحكيمها ({activeExam.notStarted.length}){canCreate && ' — اضغط على المدرسة للبدء'}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {activeExam.notStarted.map((s) =>
                                                        canCreate ? (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                onClick={() => openCreate(s.id, activeExam.value)}
                                                                className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-hidden"
                                                            >
                                                                <Badge variant="outline" className="hover:bg-muted cursor-pointer gap-1">
                                                                    <Plus className="size-3" /> {s.name}
                                                                </Badge>
                                                            </button>
                                                        ) : (
                                                            <Badge key={s.id} variant="outline">
                                                                {s.name}
                                                            </Badge>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                )}

                <DataTable
                    columns={columns}
                    data={groups}
                    searchPlaceholder="ابحث في التحكيمات..."
                    emptyMessage="لا توجد سجلات تحكيم بعد"
                    storageKey="view:reviews"
                    filters={filters}
                    renderCard={renderCard}
                    defaultView="cards"
                />
            </div>

            <FormDialog
                open={open}
                onOpenChange={setOpen}
                title="سجل تحكيم جديد"
                onSubmit={submit}
                loading={form.processing}
                submitLabel="إنشاء ومتابعة"
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label>الاختبار</Label>
                        <ToggleGroup
                            type="single"
                            size="sm"
                            dir="rtl"
                            value={form.data.exam_period}
                            onValueChange={(v) => v && form.setData('exam_period', v)}
                            className="flex-wrap justify-start gap-1"
                        >
                            {EXAM_PERIODS.map((ex) => (
                                <ToggleGroupItem
                                    key={ex.value}
                                    value={ex.value}
                                    className="border-border/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg border px-3"
                                >
                                    {ex.label}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                        {form.errors.exam_period && <p className="text-destructive text-xs">{form.errors.exam_period}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>المدرسة</Label>
                        <Combobox
                            items={schools.map((s) => ({ value: String(s.id), label: s.name }))}
                            value={form.data.school_id}
                            onChange={setSchool}
                            placeholder="ابحث عن المدرسة"
                            emptyText="لا توجد مدارس"
                        />
                        {form.errors.school_id && <p className="text-destructive text-xs">{form.errors.school_id}</p>}
                    </div>

                    {/* المادة: ثابتة من قسم الموجّه إن وُجد، وإلا قائمة اختيار */}
                    <div className="space-y-2">
                        <Label>المادة</Label>
                        {userDepartment ? (
                            <div className="border-input bg-muted/40 text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm">
                                {userDepartment.name}
                            </div>
                        ) : (
                            <Select
                                value={form.data.department_id}
                                onValueChange={(v) => form.setData((data) => ({ ...data, department_id: v, preparer_id: '' }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر" />
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
                        {form.errors.department_id && <p className="text-destructive text-xs">{form.errors.department_id}</p>}
                    </div>

                    {/* المرحلة: مشتقّة تلقائيًا من المدرسة */}
                    <div className="space-y-2">
                        <Label>المرحلة</Label>
                        <div className="border-input bg-muted/40 text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm">
                            {stageName ?? 'تُحدَّد تلقائيًا حسب المدرسة'}
                        </div>
                    </div>

                    {/* الصف: قائمة منسدلة قابلة للبحث، مصفّاة حسب مرحلة المدرسة */}
                    <div className="space-y-2">
                        <Label>الصف</Label>
                        <Combobox
                            items={gradeItems}
                            value={form.data.grade_id}
                            onChange={setGrade}
                            placeholder={form.data.school_id ? 'ابحث عن الصف' : 'اختر المدرسة أولًا'}
                            emptyText="لا توجد صفوف لهذه المرحلة"
                            disabled={!form.data.school_id}
                            anchor="top start"
                        />
                    </div>

                    {/* المسار: يظهر فقط إن كان للصف مسارات */}
                    {tracks.length > 0 && (
                        <div className="space-y-2">
                            <Label>المسار</Label>
                            <Select value={form.data.grade_track_id} onValueChange={(v) => form.setData('grade_track_id', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر المسار" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tracks.map((t) => (
                                        <SelectItem key={t.id} value={String(t.id)}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* معد الاختبار: معلّم المدرسة في نفس المادة — اختياري */}
                    <div className="space-y-2">
                        <Label>معد الاختبار</Label>
                        <Combobox
                            items={teacherItems}
                            value={form.data.preparer_id}
                            onChange={(v) => form.setData('preparer_id', v)}
                            placeholder={form.data.school_id ? 'ابحث عن المعلّم (اختياري)' : 'اختر المدرسة أولًا'}
                            emptyText="لا يوجد معلمون لهذه المدرسة في هذه المادة"
                            disabled={!form.data.school_id}
                            anchor="top start"
                        />
                        {form.errors.preparer_id && <p className="text-destructive text-xs">{form.errors.preparer_id}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="rdate">تاريخ التحكيم</Label>
                        <Input id="rdate" type="date" value={form.data.reviewed_at} onChange={(e) => form.setData('reviewed_at', e.target.value)} />
                    </div>
                </FormSection>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف سجل التحكيم"
                description="سيتم حذف السجل ومعاييره. لا يمكن التراجع."
                onConfirm={() =>
                    deleting &&
                    router.delete(`/reviews/${deleting.id}`, {
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
