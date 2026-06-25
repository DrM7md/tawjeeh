import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { usePermissions } from '@/components/shared/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type School, type Stage } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'المدارس', href: '/schools' },
];

const NONE = '__none__';
const genderLabels: Record<string, string> = { boys: 'بنين', girls: 'بنات', mixed: 'مشترك' };

export default function SchoolsIndex({ schools, stages }: { schools: School[]; stages: Stage[] }) {
    const { can } = usePermissions();
    const canManage = can('schools.manage');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<School | null>(null);
    const [deleting, setDeleting] = useState<School | null>(null);

    const form = useForm({ name: '', stage_id: '', gender: '', zone: '', is_active: true });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEdit = (s: School) => {
        setEditing(s);
        form.clearErrors();
        form.setData({
            name: s.name,
            stage_id: s.stage_id ? String(s.stage_id) : '',
            gender: s.gender ?? '',
            zone: s.zone ?? '',
            is_active: s.is_active,
        });
        setDialogOpen(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            onSuccess: () => {
                setDialogOpen(false);
                toast.success(editing ? 'تم تحديث المدرسة' : 'تم إضافة المدرسة');
            },
        };
        if (editing) form.put(`/schools/${editing.id}`, opts);
        else form.post('/schools', opts);
    };

    const confirmDelete = () => {
        if (!deleting) return;
        form.delete(`/schools/${deleting.id}`, {
            onSuccess: () => {
                setDeleting(null);
                toast.success('تم حذف المدرسة');
            },
        });
    };

    const columns: ColumnDef<School>[] = [
        { accessorKey: 'name', header: 'المدرسة', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { id: 'stage', header: 'المرحلة', cell: ({ row }) => row.original.stage?.name ?? '—' },
        { accessorKey: 'gender', header: 'النوع', cell: ({ row }) => (row.original.gender ? genderLabels[row.original.gender] : '—') },
        { accessorKey: 'zone', header: 'المنطقة', cell: ({ row }) => row.original.zone || '—' },
        {
            accessorKey: 'is_active',
            header: 'الحالة',
            cell: ({ row }) => (row.original.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">معطّل</Badge>),
        },
        ...(canManage
            ? [
                  {
                      id: 'actions',
                      header: '',
                      cell: ({ row }: { row: { original: School } }) => (
                          <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
                                  <Pencil className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)}>
                                  <Trash2 className="text-destructive size-4" />
                              </Button>
                          </div>
                      ),
                  },
              ]
            : []),
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="المدارس" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="المدارس"
                    description="إدارة بيانات المدارس"
                    actions={
                        canManage && (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" /> إضافة مدرسة
                            </Button>
                        )
                    }
                />
                <DataTable columns={columns} data={schools} searchPlaceholder="ابحث عن مدرسة..." />
            </div>

            <FormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title={editing ? 'تعديل مدرسة' : 'إضافة مدرسة'}
                onSubmit={submit}
                loading={form.processing}
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="name">اسم المدرسة</Label>
                        <Input id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        {form.errors.name && <p className="text-destructive text-xs">{form.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>المرحلة</Label>
                        <Select value={form.data.stage_id || NONE} onValueChange={(v) => form.setData('stage_id', v === NONE ? '' : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="بدون" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>بدون</SelectItem>
                                {stages.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>النوع</Label>
                        <Select value={form.data.gender || NONE} onValueChange={(v) => form.setData('gender', v === NONE ? '' : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="بدون" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>بدون</SelectItem>
                                <SelectItem value="boys">بنين</SelectItem>
                                <SelectItem value="girls">بنات</SelectItem>
                                <SelectItem value="mixed">مشترك</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="zone">المنطقة</Label>
                        <Input id="zone" value={form.data.zone} onChange={(e) => form.setData('zone', e.target.value)} />
                    </div>
                </FormSection>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                    مدرسة نشطة
                </label>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف المدرسة"
                description={`سيتم حذف «${deleting?.name}». لا يمكن التراجع.`}
                loading={form.processing}
                onConfirm={confirmDelete}
            />
        </AppLayout>
    );
}
