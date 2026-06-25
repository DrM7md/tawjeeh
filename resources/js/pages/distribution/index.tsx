import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { usePermissions } from '@/components/shared/can';
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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { GripVertical, Scale, School as SchoolIcon, Sparkles, Trash2, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'توزيع المدارس', href: '/distribution' },
];

interface SchoolRow {
    id: number;
    name: string;
    teachers: number;
    coordinators: number;
    required_visits?: number;
    weight: number;
}
interface SupervisorCol {
    id: number;
    name: string;
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
interface PageProps {
    departments: { id: number; name: string }[];
    selectedDepartmentId: number | null;
    overview: Overview | null;
    preview?: { assignments: PreviewPair[]; error?: string };
}

export default function DistributionIndex({ departments, selectedDepartmentId, overview, preview }: PageProps) {
    const { can } = usePermissions();
    const canManual = can('distribution.manual');
    const canAuto = can('distribution.auto');
    const canRedistribute = can('distribution.redistribute');

    const [dragId, setDragId] = useState<number | null>(null);
    const [previewOpen, setPreviewOpen] = useState(!!preview);
    const deptId = selectedDepartmentId;

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
                                    <span className="tnum text-muted-foreground text-xs">{overview.unassigned.length}</span>
                                </div>
                                {overview.unassigned.map(chip)}
                                {overview.unassigned.length === 0 && <p className="text-muted-foreground py-4 text-center text-xs">الكل موزّع ✓</p>}
                            </div>

                            {/* الموجهون */}
                            {overview.supervisors.map((sup) => (
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
                                        </div>
                                        <p className="text-muted-foreground tnum text-xs">
                                            {sup.schools_count} مدرسة · {sup.teachers} معلم · وزن {sup.weight.toFixed(1)}
                                        </p>
                                    </div>
                                    {sup.schools.map(chip)}
                                    {sup.schools.length === 0 && <p className="text-muted-foreground py-4 text-center text-xs">أفلت مدرسة هنا</p>}
                                </div>
                            ))}

                            {overview.supervisors.length === 0 && (
                                <p className="text-muted-foreground col-span-3 self-center text-sm">لا يوجد موجّهون في هذا القسم. أضِف موجهين من شاشة المستخدمين.</p>
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
