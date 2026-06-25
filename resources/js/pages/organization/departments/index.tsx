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
import { type BreadcrumbItem, type Department } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الأقسام', href: '/departments' },
];

interface PageProps {
    departments: Department[];
    users: { id: number; name: string }[];
}

const NONE = '__none__';

export default function DepartmentsIndex({ departments, users }: PageProps) {
    const { can } = usePermissions();
    const canManage = can('departments.manage');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Department | null>(null);
    const [deleting, setDeleting] = useState<Department | null>(null);

    const form = useForm({ name: '', code: '', head_user_id: '' as string, color: '', is_active: true });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEdit = (d: Department) => {
        setEditing(d);
        form.clearErrors();
        form.setData({
            name: d.name,
            code: d.code ?? '',
            head_user_id: d.head_user_id ? String(d.head_user_id) : '',
            color: d.color ?? '',
            is_active: d.is_active,
        });
        setDialogOpen(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            onSuccess: () => {
                setDialogOpen(false);
                toast.success(editing ? 'تم تحديث القسم' : 'تم إضافة القسم');
            },
        };
        if (editing) form.put(`/departments/${editing.id}`, opts);
        else form.post('/departments', opts);
    };

    const confirmDelete = () => {
        if (!deleting) return;
        form.delete(`/departments/${deleting.id}`, {
            onSuccess: () => {
                setDeleting(null);
                toast.success('تم حذف القسم');
            },
        });
    };

    const columns: ColumnDef<Department>[] = [
        {
            accessorKey: 'name',
            header: 'القسم',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.original.color && <span className="size-3 rounded-full" style={{ backgroundColor: row.original.color }} />}
                    <span className="font-medium">{row.original.name}</span>
                </div>
            ),
        },
        { accessorKey: 'code', header: 'الرمز', cell: ({ row }) => row.original.code || '—' },
        { id: 'head', header: 'رئيس القسم', cell: ({ row }) => row.original.head?.name ?? '—' },
        { accessorKey: 'users_count', header: 'الموجهون', cell: ({ row }) => <span className="tnum">{row.original.users_count ?? 0}</span> },
        {
            accessorKey: 'is_active',
            header: 'الحالة',
            cell: ({ row }) =>
                row.original.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">معطّل</Badge>,
        },
        ...(canManage
            ? [
                  {
                      id: 'actions',
                      header: '',
                      cell: ({ row }: { row: { original: Department } }) => (
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
            <Head title="الأقسام" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="الأقسام"
                    description="إدارة الأقسام العشرة وتعيين رؤسائها"
                    actions={
                        canManage && (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" /> إضافة قسم
                            </Button>
                        )
                    }
                />

                <DataTable columns={columns} data={departments} searchPlaceholder="ابحث عن قسم..." />
            </div>

            <FormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title={editing ? 'تعديل قسم' : 'إضافة قسم'}
                onSubmit={submit}
                loading={form.processing}
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="name">اسم القسم</Label>
                        <Input id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        {form.errors.name && <p className="text-destructive text-xs">{form.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="code">الرمز (اختياري)</Label>
                        <Input id="code" value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>رئيس القسم</Label>
                        <Select
                            value={form.data.head_user_id || NONE}
                            onValueChange={(v) => form.setData('head_user_id', v === NONE ? '' : v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="بدون" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>بدون</SelectItem>
                                {users.map((u) => (
                                    <SelectItem key={u.id} value={String(u.id)}>
                                        {u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="color">اللون</Label>
                        <Input id="color" type="color" value={form.data.color || '#8D1B3D'} onChange={(e) => form.setData('color', e.target.value)} className="h-10 w-20 p-1" />
                    </div>
                </FormSection>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                    قسم نشط
                </label>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف القسم"
                description={`سيتم حذف «${deleting?.name}». لا يمكن التراجع.`}
                loading={form.processing}
                onConfirm={confirmDelete}
            />
        </AppLayout>
    );
}
