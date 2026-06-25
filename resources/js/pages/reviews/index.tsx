import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { DataTable } from '@/components/shared/data-table';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { usePermissions } from '@/components/shared/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, ClipboardCheck, FileText, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'تحكيم الاختبارات', href: '/reviews' },
];

interface Review {
    id: number;
    grade: string | null;
    status: 'draft' | 'final';
    reviewed_at: string | null;
    school?: { name: string };
    department?: { name: string };
    stage?: { name: string };
    supervisor?: { name: string };
    form?: { total_score: string | number } | null;
}
interface Opt { id: number; name: string }
interface PageProps {
    reviews: Review[];
    schools: Opt[];
    departments: Opt[];
    stages: Opt[];
}

const NONE = '__none__';

export default function ReviewsIndex({ reviews, schools, departments, stages }: PageProps) {
    const { can } = usePermissions();
    const canCreate = can('reviews.create');

    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<Review | null>(null);
    const form = useForm({ school_id: '', department_id: '', stage_id: '', grade: '', reviewed_at: new Date().toISOString().slice(0, 10) });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/reviews', { onSuccess: () => { setOpen(false); toast.success('تم إنشاء سجل التحكيم'); } });
    };

    const stats = {
        total: reviews.length,
        final: reviews.filter((r) => r.status === 'final').length,
        draft: reviews.filter((r) => r.status === 'draft').length,
    };

    const columns: ColumnDef<Review>[] = [
        { id: 'school', header: 'المدرسة', cell: ({ row }) => <span className="font-medium">{row.original.school?.name ?? '—'}</span> },
        { id: 'department', header: 'المادة', cell: ({ row }) => row.original.department?.name ?? '—' },
        { id: 'stage', header: 'المرحلة', cell: ({ row }) => row.original.stage?.name ?? '—' },
        { accessorKey: 'grade', header: 'الصف', cell: ({ row }) => row.original.grade || '—' },
        { id: 'score', header: 'الدرجة', cell: ({ row }) => <span className="tnum">{row.original.form?.total_score ?? '—'}</span> },
        { accessorKey: 'reviewed_at', header: 'التاريخ', cell: ({ row }) => <span className="tnum">{row.original.reviewed_at ?? '—'}</span> },
        {
            accessorKey: 'status',
            header: 'الحالة',
            cell: ({ row }) => <Badge variant={row.original.status === 'final' ? 'default' : 'secondary'}>{row.original.status === 'final' ? 'معتمد' : 'مسودة'}</Badge>,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/reviews/${row.original.id}`}>
                            <FileText className="size-4" /> فتح
                        </Link>
                    </Button>
                    {canCreate && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)}>
                            <Trash2 className="text-destructive size-4" />
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="تحكيم الاختبارات" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="تحكيم الاختبارات"
                    description="سجلات تحكيم الاختبارات حسب العام والفصل المختار"
                    actions={canCreate && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> تحكيم جديد</Button>}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title="إجمالي التحكيمات" value={stats.total} icon={ClipboardCheck} tone="primary" />
                    <StatCard title="معتمدة" value={stats.final} icon={CheckCircle2} tone="success" />
                    <StatCard title="مسودات" value={stats.draft} icon={FileText} tone="warning" />
                </div>

                <DataTable columns={columns} data={reviews} searchPlaceholder="ابحث في التحكيمات..." emptyMessage="لا توجد سجلات تحكيم بعد" />
            </div>

            <FormDialog open={open} onOpenChange={setOpen} title="سجل تحكيم جديد" onSubmit={submit} loading={form.processing} submitLabel="إنشاء ومتابعة">
                <FormSection>
                    <div className="space-y-2">
                        <Label>المدرسة</Label>
                        <Select value={form.data.school_id} onValueChange={(v) => form.setData('school_id', v)}>
                            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                            <SelectContent>
                                {schools.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {form.errors.school_id && <p className="text-destructive text-xs">{form.errors.school_id}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>المادة</Label>
                        <Select value={form.data.department_id} onValueChange={(v) => form.setData('department_id', v)}>
                            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                            <SelectContent>
                                {departments.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {form.errors.department_id && <p className="text-destructive text-xs">{form.errors.department_id}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>المرحلة</Label>
                        <Select value={form.data.stage_id || NONE} onValueChange={(v) => form.setData('stage_id', v === NONE ? '' : v)}>
                            <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>بدون</SelectItem>
                                {stages.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="grade">الصف</Label>
                        <Input id="grade" placeholder="السابع / الثامن / ..." value={form.data.grade} onChange={(e) => form.setData('grade', e.target.value)} />
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
                onConfirm={() => deleting && router.delete(`/reviews/${deleting.id}`, { onSuccess: () => { setDeleting(null); toast.success('تم الحذف'); } })}
            />
        </AppLayout>
    );
}
