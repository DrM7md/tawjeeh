import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { DataTable } from '@/components/shared/data-table';
import { FormDialog } from '@/components/shared/form-dialog';
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
import { AlertTriangle, CalendarPlus, CheckCircle2, ClipboardList, Clock, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الزيارات', href: '/visits' },
];

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
interface PageProps {
    followUp: { targets: Target[]; stats: { total: number; done: number; remaining: number; late: number; completion: number } };
    visits: VisitRow[];
    departments: { id: number; name: string }[];
    selectedDepartmentId: number | null;
}

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    done: { label: 'تمت ✓', variant: 'default' },
    remaining: { label: 'متبقٍ', variant: 'secondary' },
    late: { label: 'متأخر', variant: 'destructive' },
};

export default function VisitsIndex({ followUp, visits, departments, selectedDepartmentId }: PageProps) {
    const { can } = usePermissions();
    const canCreate = can('visits.create');

    const [recordOpen, setRecordOpen] = useState(false);
    const [target, setTarget] = useState<Target | null>(null);
    const form = useForm({ visit_type: '', visitable_id: 0, visit_date: new Date().toISOString().slice(0, 10) });

    const openRecord = (t: Target) => {
        setTarget(t);
        form.setData({ visit_type: t.type, visitable_id: t.id, visit_date: new Date().toISOString().slice(0, 10) });
        setRecordOpen(true);
    };
    const submitRecord = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/visits', { onSuccess: () => { setRecordOpen(false); toast.success('تم تسجيل الزيارة'); } });
    };

    const changeDept = (id: string) => router.get('/visits', { department: id === 'all' ? undefined : id }, { preserveState: false });

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
        { accessorKey: 'status', header: 'الحالة', cell: ({ row }) => <Badge variant={statusBadge[row.original.status].variant}>{statusBadge[row.original.status].label}</Badge> },
        ...(canCreate
            ? [
                  {
                      id: 'actions',
                      header: '',
                      cell: ({ row }: { row: { original: Target } }) => (
                          <Button variant="ghost" size="sm" onClick={() => openRecord(row.original)}>
                              <CalendarPlus className="size-4" /> تسجيل زيارة
                          </Button>
                      ),
                  },
              ]
            : []),
    ];

    const visitColumns: ColumnDef<VisitRow>[] = [
        { accessorKey: 'visit_date', header: 'التاريخ', cell: ({ row }) => <span className="tnum">{row.original.visit_date}</span> },
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
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/visits/${row.original.id}`}>
                        <FileText className="size-4" /> فتح
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="الزيارات والمتابعة" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="الزيارات والمتابعة"
                    description="متابعة إنجاز الزيارات حسب العام والفصل المختار"
                    actions={
                        departments.length > 1 && (
                            <Select value={selectedDepartmentId ? String(selectedDepartmentId) : 'all'} onValueChange={changeDept}>
                                <SelectTrigger className="min-w-[160px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الأقسام</SelectItem>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={String(d.id)}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="نسبة الإنجاز" value={`${followUp.stats.completion}%`} icon={ClipboardList} tone="primary" hint={`${followUp.stats.total} مستهدف`} />
                    <StatCard title="تمت" value={followUp.stats.done} icon={CheckCircle2} tone="success" />
                    <StatCard title="متبقٍ" value={followUp.stats.remaining} icon={Clock} tone="warning" />
                    <StatCard title="متأخر" value={followUp.stats.late} icon={AlertTriangle} tone="destructive" />
                </div>

                <div className="space-y-3">
                    <h2 className="text-xl font-semibold">لوحة المتابعة</h2>
                    <DataTable columns={targetColumns} data={followUp.targets} searchPlaceholder="ابحث عن معلم/منسق..." pageSize={15} emptyMessage="لا يوجد مستهدفون — تأكد من الاستيراد والتوزيع" />
                </div>

                <div className="space-y-3">
                    <h2 className="text-xl font-semibold">الزيارات المسجّلة</h2>
                    <DataTable columns={visitColumns} data={visits} searchPlaceholder="ابحث في الزيارات..." emptyMessage="لا توجد زيارات بعد" />
                </div>
            </div>

            <FormDialog
                open={recordOpen}
                onOpenChange={setRecordOpen}
                title={`تسجيل زيارة: ${target?.name ?? ''}`}
                description="سيتم ربط الزيارة بالعام والفصل الحالي. أكمل الاستمارة بعد التسجيل."
                onSubmit={submitRecord}
                loading={form.processing}
                submitLabel="تسجيل ومتابعة"
            >
                <div className="space-y-2">
                    <Label htmlFor="visit_date">تاريخ الزيارة</Label>
                    <Input id="visit_date" type="date" value={form.data.visit_date} onChange={(e) => form.setData('visit_date', e.target.value)} />
                    {form.errors.visit_date && <p className="text-destructive text-xs">{form.errors.visit_date}</p>}
                </div>
            </FormDialog>
        </AppLayout>
    );
}
