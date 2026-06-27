import {
    DepartmentsLevel,
    DrilldownBack,
    GenderTabs,
    supervisorInGenderTab,
    type DeptBoardItem,
    type GenderTab,
    type SupervisorGender,
} from '@/components/shared/drilldown-cards';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { CalendarClock, CheckCircle2, ClipboardList, RotateCcw, Send, Sparkles, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type PlanStatus = 'none' | 'draft' | 'submitted' | 'approved' | 'rejected';

interface PlanItem {
    id?: number;
    kind: 'teacher' | 'coordinator';
    visitable_id: number;
    name: string;
    school_id: number;
    school_name: string | null;
    classification_id: number | null;
    classification_name: string | null;
    classification_color: string | null;
    planned_visits: number;
    notes: string | null;
}

interface Plan {
    id: number;
    status: PlanStatus;
    supervisor_id: number;
    supervisor_name: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    reviewer_name: string | null;
    review_notes: string | null;
    items: PlanItem[];
}

interface OverviewRow {
    supervisor_id: number;
    supervisor_name: string;
    gender: SupervisorGender;
    plan_id: number | null;
    status: PlanStatus;
    items_count: number;
    planned_total: number;
    submitted_at: string | null;
    review_notes: string | null;
    items: PlanItem[];
}

interface DepartmentOverview {
    rows: OverviewRow[];
    totals: { supervisors: number; submitted: number; approved: number; pending: number };
}

interface NamedRef {
    id: number;
    name: string;
}
interface BoardProps {
    canCreate: boolean;
    canApprove: boolean;
    isEditable: boolean;
    myPlan: Plan | null;
    preview?: { rows: PlanItem[]; error?: string };
    departmentOverview: DepartmentOverview | null;
    contextDepartment?: NamedRef | null;
    canDrillDepartments?: boolean;
}
interface PageProps {
    view?: 'departments' | 'board';
    // مستوى الأقسام (رئيس التوجيه)
    departmentCards?: DeptBoardItem[];
    // مستوى اللوحة
    canCreate?: boolean;
    canApprove?: boolean;
    isEditable?: boolean;
    myPlan?: Plan | null;
    preview?: { rows: PlanItem[]; error?: string };
    departmentOverview?: DepartmentOverview | null;
    contextDepartment?: NamedRef | null;
    canDrillDepartments?: boolean;
}

const STATUS_META: Record<PlanStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    none: { label: 'لم تُنشأ', variant: 'outline' },
    draft: { label: 'مسودة', variant: 'secondary' },
    submitted: { label: 'بانتظار الاعتماد', variant: 'default' },
    approved: { label: 'معتمدة', variant: 'default' },
    rejected: { label: 'مُرجعة للتعديل', variant: 'destructive' },
};

function StatusBadge({ status }: { status: PlanStatus }) {
    const meta = STATUS_META[status];
    return (
        <Badge
            variant={meta.variant}
            className={cn(status === 'approved' && 'bg-success text-success-foreground hover:bg-success/80')}
        >
            {meta.label}
        </Badge>
    );
}

/** يجمع صفوف الخطة حسب المدرسة للعرض. */
function groupBySchool(items: PlanItem[]) {
    const map = new Map<number, { school_name: string | null; rows: PlanItem[] }>();
    for (const it of items) {
        if (!map.has(it.school_id)) map.set(it.school_id, { school_name: it.school_name, rows: [] });
        map.get(it.school_id)!.rows.push(it);
    }
    return [...map.entries()].map(([school_id, v]) => ({ school_id, ...v }));
}

function BoardLevel({ canCreate, canApprove, isEditable, myPlan, preview, departmentOverview, contextDepartment, canDrillDepartments }: Readonly<BoardProps>) {
    const [genderTab, setGenderTab] = useState<GenderTab>('all');
    const overviewRows = departmentOverview ? departmentOverview.rows.filter((r) => supervisorInGenderTab(r.gender, genderTab)) : [];
    const crumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'خطة الموجّه', href: '/planning' },
        ...(contextDepartment ? [{ title: contextDepartment.name, href: '#' }] : []),
    ];

    // ===== محرّر خطة الموجّه =====
    const planStatus: PlanStatus = myPlan?.status ?? 'none';
    const planLocked = myPlan ? !['draft', 'rejected'].includes(myPlan.status) : false;
    const editable = canCreate && isEditable && !planLocked;

    const [items, setItems] = useState<PlanItem[]>(myPlan?.items ?? []);
    const [dirty, setDirty] = useState(false);

    // عند وصول معاينة توليد جديدة من الخادم، استبدل صفوف العمل.
    useEffect(() => {
        if (!preview) return;
        if (preview.error) {
            toast.error(preview.error);
            return;
        }
        setItems(preview.rows);
        setDirty(true);
        toast.success(`تم توليد ${preview.rows.length} صفًّا من التصنيف`);
    }, [preview]);

    const totalPlanned = items.reduce((s, i) => s + (Number(i.planned_visits) || 0), 0);
    const schoolsCount = new Set(items.map((i) => i.school_id)).size;

    const setVisits = (vid: number, kind: string, value: number) => {
        setItems((prev) => prev.map((i) => (i.visitable_id === vid && i.kind === kind ? { ...i, planned_visits: value } : i)));
        setDirty(true);
    };
    const removeRow = (vid: number, kind: string) => {
        setItems((prev) => prev.filter((i) => !(i.visitable_id === vid && i.kind === kind)));
        setDirty(true);
    };

    const generate = () => router.post('/planning/generate-preview', {}, { preserveScroll: true });

    const saveDraft = () => {
        router.post(
            '/planning',
            {
                items: items.map((i) => ({
                    kind: i.kind,
                    visitable_id: i.visitable_id,
                    school_id: i.school_id,
                    classification_id: i.classification_id,
                    planned_visits: i.planned_visits,
                    notes: i.notes,
                })),
            },
            { preserveScroll: true, onSuccess: () => setDirty(false) },
        );
    };

    const submitPlan = () => {
        if (!myPlan?.id) return;
        router.post(`/planning/${myPlan.id}/submit`, {}, { preserveScroll: true });
    };

    // ===== مراجعة رئيس القسم =====
    const [reviewing, setReviewing] = useState<OverviewRow | null>(null);
    const [returnMode, setReturnMode] = useState(false);
    const [reviewNotes, setReviewNotes] = useState('');

    const openReview = (row: OverviewRow) => {
        setReviewing(row);
        setReturnMode(false);
        setReviewNotes('');
    };

    const approve = () => {
        if (!reviewing?.plan_id) return;
        router.post(
            `/planning/${reviewing.plan_id}/approve`,
            { notes: reviewNotes || null },
            { preserveScroll: true, onSuccess: () => setReviewing(null) },
        );
    };
    const returnPlan = () => {
        if (!reviewing?.plan_id) return;
        if (!reviewNotes.trim()) {
            toast.error('اكتب ملاحظات الإرجاع');
            return;
        }
        router.post(
            `/planning/${reviewing.plan_id}/return`,
            { notes: reviewNotes },
            { preserveScroll: true, onSuccess: () => setReviewing(null) },
        );
    };

    const grouped = groupBySchool(items);

    return (
        <AppLayout breadcrumbs={crumbs}>
            <Head title={contextDepartment ? `خطة الموجّه — ${contextDepartment.name}` : 'خطة الموجّه'} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {canDrillDepartments && <DrilldownBack href="/planning" label="رجوع إلى الأقسام" />}
                <PageHeader
                    title={contextDepartment ? `خطط القسم: ${contextDepartment.name}` : 'خطة الزيارات والتصنيف'}
                    description="تُولَّد خطة الزيارات مبدئيًا من تصنيف المعلمين، ثم تُرسل لرئيس القسم لاعتمادها."
                />

                {!isEditable && (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                        أنت تستعرض عامًا دراسيًا غير نشط — التعديل متاح فقط في العام النشط.
                    </p>
                )}

                {/* ================= محرّر خطة الموجّه ================= */}
                {canCreate && (
                    <section className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="text-primary size-5" />
                                <h2 className="text-lg font-semibold">خطتي</h2>
                                <StatusBadge status={planStatus} />
                            </div>
                            {editable && (
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" onClick={generate}>
                                        <Sparkles className="size-4" /> {items.length ? 'إعادة التوليد من التصنيف' : 'توليد من التصنيف'}
                                    </Button>
                                    <Button variant="secondary" onClick={saveDraft} disabled={!items.length}>
                                        حفظ كمسودة
                                    </Button>
                                    <Button onClick={submitPlan} disabled={!myPlan?.id || dirty || !items.length}>
                                        <Send className="size-4" /> إرسال للاعتماد
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* ملاحظات المراجعة */}
                        {myPlan?.review_notes && (
                            <div
                                className={cn(
                                    'rounded-xl border p-3 text-sm',
                                    myPlan.status === 'approved'
                                        ? 'border-success/40 bg-success/10 text-success'
                                        : 'border-destructive/40 bg-destructive/10 text-destructive',
                                )}
                            >
                                <span className="font-semibold">
                                    {myPlan.status === 'approved' ? 'اعتماد رئيس القسم' : 'أُرجعت للتعديل'}
                                    {myPlan.reviewer_name ? ` — ${myPlan.reviewer_name}` : ''}:
                                </span>{' '}
                                {myPlan.review_notes}
                            </div>
                        )}

                        {dirty && editable && (
                            <p className="text-muted-foreground text-xs">لديك تغييرات غير محفوظة — احفظ المسودة قبل الإرسال.</p>
                        )}

                        {items.length > 0 ? (
                            <>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <StatCard title="عدد المستهدفين" value={items.length} icon={Users} tone="primary" hint={`${schoolsCount} مدرسة`} />
                                    <StatCard title="إجمالي الزيارات المخطّطة" value={totalPlanned} icon={CalendarClock} tone="info" />
                                    <StatCard title="الحالة" value={STATUS_META[planStatus].label} icon={CheckCircle2} tone={planStatus === 'approved' ? 'success' : 'warning'} />
                                </div>

                                <div className="flex flex-col gap-5">
                                    {grouped.map((g) => (
                                        <div key={g.school_id} className="bg-card overflow-hidden rounded-2xl border border-border/60">
                                            <div className="bg-muted/40 flex items-center justify-between px-4 py-2.5">
                                                <span className="font-semibold">{g.school_name ?? '—'}</span>
                                                <span className="text-muted-foreground tnum text-xs">{g.rows.length} مستهدف</span>
                                            </div>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>الاسم</TableHead>
                                                        <TableHead>النوع</TableHead>
                                                        <TableHead>التصنيف</TableHead>
                                                        <TableHead className="w-40">الزيارات المخطّطة</TableHead>
                                                        {editable && <TableHead className="w-12"></TableHead>}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {g.rows.map((r) => (
                                                        <TableRow key={`${r.kind}-${r.visitable_id}`}>
                                                            <TableCell className="font-medium">{r.name}</TableCell>
                                                            <TableCell>{r.kind === 'coordinator' ? 'منسق' : 'معلم'}</TableCell>
                                                            <TableCell>
                                                                {r.classification_name ? (
                                                                    <span className="inline-flex items-center gap-1.5">
                                                                        <span
                                                                            className="size-2.5 rounded-full"
                                                                            style={{ backgroundColor: r.classification_color ?? '#999' }}
                                                                        />
                                                                        {r.classification_name}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">—</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {editable ? (
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        max={99}
                                                                        value={r.planned_visits}
                                                                        onChange={(e) => setVisits(r.visitable_id, r.kind, Number(e.target.value))}
                                                                        className="h-9 w-24 tnum"
                                                                    />
                                                                ) : (
                                                                    <span className="tnum font-semibold">{r.planned_visits}</span>
                                                                )}
                                                            </TableCell>
                                                            {editable && (
                                                                <TableCell>
                                                                    <Button variant="ghost" size="icon" onClick={() => removeRow(r.visitable_id, r.kind)}>
                                                                        <Trash2 className="text-destructive size-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            )}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="bg-muted/30 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
                                <ClipboardList className="text-muted-foreground size-8" />
                                <p className="text-muted-foreground text-sm">لا توجد خطة بعد.</p>
                                {editable && (
                                    <Button onClick={generate}>
                                        <Sparkles className="size-4" /> توليد الخطة من التصنيف
                                    </Button>
                                )}
                            </div>
                        )}
                    </section>
                )}

                {/* ================= مراجعة رئيس القسم ================= */}
                {canApprove && departmentOverview && (
                    <section className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="text-primary size-5" />
                            <h2 className="text-lg font-semibold">اعتماد خطط القسم</h2>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="الموجهون" value={departmentOverview.totals.supervisors} icon={Users} tone="primary" />
                            <StatCard title="بانتظار الاعتماد" value={departmentOverview.totals.submitted} icon={CalendarClock} tone="warning" />
                            <StatCard title="معتمدة" value={departmentOverview.totals.approved} icon={CheckCircle2} tone="success" />
                            <StatCard title="لم تُرسَل" value={departmentOverview.totals.pending} icon={ClipboardList} tone="info" />
                        </div>

                        <GenderTabs value={genderTab} onChange={setGenderTab} />

                        <div className="bg-card overflow-hidden rounded-2xl border border-border/60">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الموجّه</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>المستهدفون</TableHead>
                                        <TableHead>إجمالي الزيارات</TableHead>
                                        <TableHead>تاريخ الإرسال</TableHead>
                                        <TableHead className="w-32"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {overviewRows.map((row) => (
                                        <TableRow key={row.supervisor_id}>
                                            <TableCell className="font-medium">{row.supervisor_name}</TableCell>
                                            <TableCell><StatusBadge status={row.status} /></TableCell>
                                            <TableCell className="tnum">{row.items_count}</TableCell>
                                            <TableCell className="tnum">{row.planned_total}</TableCell>
                                            <TableCell className="tnum text-muted-foreground">{row.submitted_at ?? '—'}</TableCell>
                                            <TableCell>
                                                {row.plan_id && row.status !== 'none' && row.status !== 'draft' && (
                                                    <Button variant="outline" size="sm" onClick={() => openReview(row)}>
                                                        مراجعة
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {overviewRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                                لا يوجد موجّهون مطابقون.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </section>
                )}
            </div>

            {/* حوار مراجعة خطة موجّه */}
            <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>خطة: {reviewing?.supervisor_name}</DialogTitle>
                        <DialogDescription>
                            {reviewing?.items_count} مستهدف · {reviewing?.planned_total} زيارة مخطّطة
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[45vh] space-y-3 overflow-y-auto">
                        {reviewing && groupBySchool(reviewing.items).map((g) => (
                            <div key={g.school_id} className="rounded-xl border border-border/60">
                                <div className="bg-muted/40 px-3 py-1.5 text-sm font-semibold">{g.school_name ?? '—'}</div>
                                <div className="divide-y divide-border/60">
                                    {g.rows.map((r) => (
                                        <div key={`${r.kind}-${r.visitable_id}`} className="flex items-center justify-between px-3 py-1.5 text-sm">
                                            <span className="flex items-center gap-2">
                                                {r.name}
                                                <span className="text-muted-foreground text-xs">({r.kind === 'coordinator' ? 'منسق' : 'معلم'})</span>
                                                {r.classification_name && (
                                                    <span className="inline-flex items-center gap-1 text-xs">
                                                        <span className="size-2 rounded-full" style={{ backgroundColor: r.classification_color ?? '#999' }} />
                                                        {r.classification_name}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="tnum text-primary font-medium">{r.planned_visits} زيارة</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {reviewing?.status === 'submitted' && (
                        <div className="space-y-2">
                            <textarea
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                placeholder={returnMode ? 'اكتب ملاحظات الإرجاع (مطلوبة)…' : 'ملاحظات الاعتماد (اختياري)…'}
                                rows={3}
                                className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-hidden"
                            />
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-2">
                        {reviewing?.status === 'submitted' ? (
                            returnMode ? (
                                <>
                                    <Button variant="outline" onClick={() => setReturnMode(false)}>رجوع</Button>
                                    <Button variant="destructive" onClick={returnPlan}>
                                        <RotateCcw className="size-4" /> تأكيد الإرجاع
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => setReturnMode(true)}>
                                        <RotateCcw className="size-4" /> إرجاع للتعديل
                                    </Button>
                                    <Button onClick={approve}>
                                        <CheckCircle2 className="size-4" /> اعتماد الخطة
                                    </Button>
                                </>
                            )
                        ) : (
                            <Button variant="outline" onClick={() => setReviewing(null)}>إغلاق</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

/* ===================== التبديل بين المستويات ===================== */
export default function PlanningIndex(props: Readonly<PageProps>) {
    if (props.view === 'departments') {
        return (
            <DepartmentsLevel
                base="/planning"
                crumbLabel="خطة الموجّه"
                title="خطط الزيارات والتصنيف"
                description="اختر القسم لعرض موجّهيه وحالة اعتماد خططهم"
                unit="موجّه"
                departments={props.departmentCards ?? []}
            />
        );
    }

    return (
        <BoardLevel
            canCreate={props.canCreate ?? false}
            canApprove={props.canApprove ?? false}
            isEditable={props.isEditable ?? false}
            myPlan={props.myPlan ?? null}
            preview={props.preview}
            departmentOverview={props.departmentOverview ?? null}
            contextDepartment={props.contextDepartment}
            canDrillDepartments={props.canDrillDepartments}
        />
    );
}
