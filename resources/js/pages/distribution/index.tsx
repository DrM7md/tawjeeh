import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { usePermissions } from '@/components/shared/can';
import { aggregate, BoardCard, DrilldownBack, type Stats } from '@/components/shared/drilldown-cards';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Building2, GripVertical, Scale, School as SchoolIcon, Sparkles, Trash2, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'توزيع المدارس', href: '/distribution' },
];

type SchoolGender = 'boys' | 'girls' | 'mixed' | null;

interface SchoolRow {
    id: number;
    name: string;
    gender: SchoolGender;
    teachers: number;
    coordinators: number;
    required_visits?: number;
    weight: number;
}
interface SupervisorCol {
    id: number;
    name: string;
    gender: 'male' | 'female' | null;
    schools: SchoolRow[];
    schools_count: number;
    teachers: number;
    coordinators: number;
    weight: number;
}
interface Overview {
    supervisors: SupervisorCol[];
    unassigned: SchoolRow[];
    fairness: number;
    totals: { schools: number; assigned: number; supervisors: number; avg_schools: number };
}
interface PreviewPair {
    school_id: number;
    school_name: string;
    supervisor_id: number;
    supervisor_name: string;
}
interface DeptBoard extends Stats {
    id: number;
    name: string;
    supervisors: number;
}

interface BoardProps {
    departments: { id: number; name: string }[];
    selectedDepartmentId: number | null;
    overview: Overview | null;
    preview?: { assignments: PreviewPair[]; error?: string; warning?: string | null };
    canDrillDepartments?: boolean;
}

interface PageProps {
    view?: 'departments' | 'board';
    // مستوى الأقسام (رئيس التوجيه)
    departmentCards?: DeptBoard[];
    schoolsTotal?: number;
    // مستوى اللوحة
    departments?: { id: number; name: string }[];
    selectedDepartmentId?: number | null;
    overview?: Overview | null;
    preview?: { assignments: PreviewPair[]; error?: string; warning?: string | null };
    canDrillDepartments?: boolean;
}

function BoardLevel({ departments, selectedDepartmentId, overview, preview, canDrillDepartments }: Readonly<BoardProps>) {
    const { can } = usePermissions();
    const canManual = can('distribution.manual');
    const canAuto = can('distribution.auto');
    const canRedistribute = can('distribution.redistribute');

    const [dragId, setDragId] = useState<number | null>(null);
    const [previewOpen, setPreviewOpen] = useState(!!preview);
    const [genderTab, setGenderTab] = useState<'all' | 'boys' | 'girls'>('all');
    const deptId = selectedDepartmentId;

    // مدرسة تظهر في التبويب: المشتركة/غير المحددة تظهر في الجميع، وإلا حسب نوعها.
    const schoolInTab = (g: SchoolGender) => genderTab === 'all' || !g || g === 'mixed' || g === genderTab;
    // موجِّه يظهر في التبويب: غير المحدد يظهر في الجميع، وإلا الذكور في بنين والإناث في بنات.
    const supInTab = (g: 'male' | 'female' | null) =>
        genderTab === 'all' || !g || (genderTab === 'boys' ? g === 'male' : g === 'female');

    const visibleUnassigned = overview ? overview.unassigned.filter((s) => schoolInTab(s.gender)) : [];
    const visibleSupervisors = overview
        ? overview.supervisors
              .filter((sup) => supInTab(sup.gender))
              .map((sup) => ({ ...sup, schools: sup.schools.filter((s) => schoolInTab(s.gender)) }))
        : [];

    const changeDept = (id: string) => router.get('/distribution', { department: id }, { preserveState: false });

    const assignTo = (schoolId: number, supervisorId: number) => {
        if (!canManual || !deptId) return;
        router.post('/distribution/assign', { department_id: deptId, school_id: schoolId, supervisor_id: supervisorId }, { preserveScroll: true });
    };
    const unassign = (schoolId: number) => {
        if (!canManual || !deptId) return;
        router.post('/distribution/unassign', { department_id: deptId, school_id: schoolId }, { preserveScroll: true });
    };

    const runAuto = (scope: 'unassigned' | 'all') => {
        if (!deptId) return;
        router.post('/distribution/auto-preview', { department_id: deptId, scope }, { preserveScroll: true, onSuccess: () => setPreviewOpen(true) });
    };

    const applyPreview = () => {
        if (!deptId || !preview?.assignments?.length) return;
        router.post(
            '/distribution/apply',
            { department_id: deptId, method: 'auto', assignments: preview.assignments.map((a) => ({ school_id: a.school_id, supervisor_id: a.supervisor_id })) },
            { preserveScroll: true, onSuccess: () => { setPreviewOpen(false); toast.success('تم تطبيق التوزيع التلقائي'); } },
        );
    };

    const clearAll = () => {
        if (!deptId) return;
        router.post('/distribution/clear', { department_id: deptId }, { preserveScroll: true, onSuccess: () => toast.success('تم مسح التوزيع') });
    };

    const onDrop = (supervisorId: number | null) => {
        if (dragId == null) return;
        supervisorId == null ? unassign(dragId) : assignTo(dragId, supervisorId);
        setDragId(null);
    };

    const chip = (s: SchoolRow) => (
        <div
            key={s.id}
            draggable={canManual}
            onDragStart={() => setDragId(s.id)}
            className="bg-card flex items-center justify-between gap-2 rounded-xl border border-border/60 p-2.5 text-sm shadow-sm transition hover:shadow"
        >
            <div className="flex items-center gap-2">
                {canManual && <GripVertical className="text-muted-foreground size-4 cursor-grab" />}
                {s.gender === 'boys' && <span className="size-2 rounded-full bg-sky-500" title="بنين" />}
                {s.gender === 'girls' && <span className="size-2 rounded-full bg-pink-500" title="بنات" />}
                {s.gender === 'mixed' && <span className="size-2 rounded-full bg-amber-500" title="مشترك" />}
                <span className="font-medium">{s.name}</span>
            </div>
            <span className="text-muted-foreground tnum text-xs">
                {s.teachers}م · {s.coordinators}ن · وزن {s.weight}
            </span>
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="توزيع المدارس" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {canDrillDepartments && <DrilldownBack href="/distribution" label="رجوع إلى الأقسام" />}
                <PageHeader
                    title="توزيع المدارس على الموجهين"
                    description="اسحب المدرسة لإسنادها لموجه، أو استخدم التوزيع التلقائي العادل"
                    actions={
                        <div className="flex items-center gap-2">
                            <Select value={deptId ? String(deptId) : undefined} onValueChange={changeDept}>
                                <SelectTrigger className="min-w-[180px]">
                                    <SelectValue placeholder="اختر القسم" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={String(d.id)}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    }
                />

                {!overview ? (
                    <p className="text-muted-foreground">اختر قسمًا لعرض التوزيع.</p>
                ) : (
                    <>
                        <Tabs value={genderTab} onValueChange={(v) => setGenderTab(v as 'all' | 'boys' | 'girls')}>
                            <TabsList>
                                <TabsTrigger value="all">الكل</TabsTrigger>
                                <TabsTrigger value="boys">بنين</TabsTrigger>
                                <TabsTrigger value="girls">بنات</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="إجمالي المدارس" value={overview.totals.schools} icon={SchoolIcon} tone="primary" />
                            <StatCard title="المُسندة" value={overview.totals.assigned} icon={SchoolIcon} tone="success" hint={`غير مسندة: ${overview.unassigned.length}`} />
                            <StatCard title="الموجهون" value={overview.totals.supervisors} icon={Users} tone="info" hint={`متوسط ${overview.totals.avg_schools} مدرسة`} />
                            <StatCard title="نسبة العدالة" value={`${overview.fairness}%`} icon={Scale} tone={overview.fairness >= 80 ? 'success' : overview.fairness >= 60 ? 'warning' : 'destructive'} />
                        </div>

                        {(canAuto || canRedistribute) && (
                            <div className="flex flex-wrap gap-2">
                                {canAuto && (
                                    <Button variant="outline" onClick={() => runAuto('unassigned')}>
                                        <Sparkles className="size-4" /> توزيع تلقائي للمتبقّي
                                    </Button>
                                )}
                                {canAuto && (
                                    <Button variant="outline" onClick={() => runAuto('all')}>
                                        <Sparkles className="size-4" /> إعادة توزيع الكل
                                    </Button>
                                )}
                                {canRedistribute && overview.totals.assigned > 0 && (
                                    <Button variant="ghost" onClick={clearAll}>
                                        <Trash2 className="text-destructive size-4" /> مسح التوزيع
                                    </Button>
                                )}
                            </div>
                        )}

                        <div className="grid gap-4 lg:grid-cols-4">
                            {/* غير موزّعة */}
                            <div
                                onDragOver={(e) => canManual && e.preventDefault()}
                                onDrop={() => onDrop(null)}
                                className="bg-muted/40 flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-dashed border-border p-3"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold">غير موزّعة</span>
                                    <span className="tnum text-muted-foreground text-xs">{visibleUnassigned.length}</span>
                                </div>
                                {visibleUnassigned.map(chip)}
                                {visibleUnassigned.length === 0 && <p className="text-muted-foreground py-4 text-center text-xs">الكل موزّع ✓</p>}
                            </div>

                            {/* الموجهون */}
                            {visibleSupervisors.map((sup) => (
                                <div
                                    key={sup.id}
                                    onDragOver={(e) => canManual && e.preventDefault()}
                                    onDrop={() => onDrop(sup.id)}
                                    className="bg-card flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-border/60 p-3"
                                >
                                    <div className="space-y-1 border-b border-border/60 pb-2">
                                        <div className="flex items-center gap-2">
                                            <UserRound className="text-primary size-4" />
                                            <span className="text-sm font-semibold">{sup.name}</span>
                                            {sup.gender === 'male' && <span className="text-sky-600 text-xs">(موجِّه)</span>}
                                            {sup.gender === 'female' && <span className="text-pink-600 text-xs">(موجِّهة)</span>}
                                        </div>
                                        <p className="text-muted-foreground tnum text-xs">
                                            {sup.schools_count} مدرسة · {sup.teachers} معلم · وزن {sup.weight.toFixed(1)}
                                        </p>
                                    </div>
                                    {sup.schools.map(chip)}
                                    {sup.schools.length === 0 && <p className="text-muted-foreground py-4 text-center text-xs">أفلت مدرسة هنا</p>}
                                </div>
                            ))}

                            {visibleSupervisors.length === 0 && (
                                <p className="text-muted-foreground col-span-3 self-center text-sm">
                                    {overview.supervisors.length === 0
                                        ? 'لا يوجد موجّهون في هذا القسم. أضِف موجهين من شاشة المستخدمين.'
                                        : 'لا يوجد موجّهون مطابقون لهذا التبويب. حدّد نوع الموجِّه من شاشة المستخدمين.'}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* معاينة التوزيع التلقائي */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>معاينة التوزيع التلقائي</DialogTitle>
                        <DialogDescription>راجع الإسناد المقترح قبل التطبيق.</DialogDescription>
                    </DialogHeader>
                    {preview?.error ? (
                        <p className="text-destructive text-sm">{preview.error}</p>
                    ) : (
                        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
                            {preview?.warning && (
                                <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">⚠ {preview.warning}</p>
                            )}
                            {preview?.assignments?.length ? (
                                preview.assignments.map((a) => (
                                    <div key={a.school_id} className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-sm">
                                        <span>{a.school_name}</span>
                                        <span className="text-primary font-medium">← {a.supervisor_name}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-sm">لا توجد مدارس للتوزيع.</p>
                            )}
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                            إلغاء
                        </Button>
                        <Button onClick={applyPreview} disabled={!preview?.assignments?.length}>
                            تطبيق التوزيع
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

/* ===================== مستوى الأقسام (رئيس التوجيه) ===================== */
function DepartmentsLevel({ departmentCards, schoolsTotal }: Readonly<{ departmentCards: DeptBoard[]; schoolsTotal: number }>) {
    const totals = aggregate(departmentCards);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="توزيع المدارس — الأقسام" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="توزيع المدارس على الموجهين" description="اختر القسم لعرض لوحة توزيع مدارسه على موجّهيه" />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="إجمالي المدارس" value={schoolsTotal} icon={SchoolIcon} tone="primary" />
                    <StatCard title="المُسندة (إجمالًا)" value={totals.done} icon={SchoolIcon} tone="success" />
                    <StatCard title="نسبة التوزيع" value={`${totals.completion}%`} icon={Scale} tone="info" />
                    <StatCard title="الأقسام" value={departmentCards.length} icon={Building2} tone="info" />
                </div>

                {departmentCards.length === 0 ? (
                    <p className="text-muted-foreground">لا توجد أقسام.</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {departmentCards.map((d) => (
                            <BoardCard
                                key={d.id}
                                href={`/distribution?department=${d.id}`}
                                name={d.name}
                                icon={Building2}
                                subtitle={`${d.supervisors} موجّه`}
                                stats={d}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

/* ===================== التبديل بين المستويات ===================== */
export default function DistributionIndex(props: Readonly<PageProps>) {
    if (props.view === 'departments') {
        return <DepartmentsLevel departmentCards={props.departmentCards ?? []} schoolsTotal={props.schoolsTotal ?? 0} />;
    }

    return (
        <BoardLevel
            departments={props.departments ?? []}
            selectedDepartmentId={props.selectedDepartmentId ?? null}
            overview={props.overview ?? null}
            preview={props.preview}
            canDrillDepartments={props.canDrillDepartments}
        />
    );
}
