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
import { type BreadcrumbItem, type DomainUser, type Role } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'المستخدمون', href: '/users' },
];

const NONE = '__none__';

interface PageProps {
    users: DomainUser[];
    departments: { id: number; name: string }[];
    roles: Role[];
}

export default function UsersIndex({ users, departments, roles }: PageProps) {
    const { can } = usePermissions();
    const canCreate = can('users.create');
    const canUpdate = can('users.update');
    const canDelete = can('users.delete');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<DomainUser | null>(null);
    const [deleting, setDeleting] = useState<DomainUser | null>(null);

    const form = useForm<{
        name: string;
        email: string;
        password: string;
        password_confirmation: string;
        department_id: string;
        phone: string;
        is_active: boolean;
        role_ids: number[];
    }>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        department_id: '',
        phone: '',
        is_active: true,
        role_ids: [],
    });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEdit = (u: DomainUser) => {
        setEditing(u);
        form.clearErrors();
        form.setData({
            name: u.name,
            email: u.email,
            password: '',
            password_confirmation: '',
            department_id: u.department_id ? String(u.department_id) : '',
            phone: u.phone ?? '',
            is_active: u.is_active,
            role_ids: u.roles?.map((r) => r.id) ?? [],
        });
        setDialogOpen(true);
    };

    const toggleRole = (id: number) => {
        const set = new Set(form.data.role_ids);
        set.has(id) ? set.delete(id) : set.add(id);
        form.setData('role_ids', Array.from(set));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            onSuccess: () => {
                setDialogOpen(false);
                toast.success(editing ? 'تم تحديث المستخدم' : 'تم إضافة المستخدم');
            },
        };
        if (editing) form.put(`/users/${editing.id}`, opts);
        else form.post('/users', opts);
    };

    const confirmDelete = () => {
        if (!deleting) return;
        form.delete(`/users/${deleting.id}`, {
            onSuccess: () => {
                setDeleting(null);
                toast.success('تم حذف المستخدم');
            },
        });
    };

    const columns: ColumnDef<DomainUser>[] = [
        { accessorKey: 'name', header: 'الاسم', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { accessorKey: 'email', header: 'البريد' },
        { id: 'department', header: 'القسم', cell: ({ row }) => row.original.department?.name ?? '—' },
        {
            id: 'roles',
            header: 'الأدوار',
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.roles?.length
                        ? row.original.roles.map((r) => (
                              <Badge key={r.id} variant="secondary">
                                  {r.display_name}
                              </Badge>
                          ))
                        : '—'}
                </div>
            ),
        },
        {
            accessorKey: 'is_active',
            header: 'الحالة',
            cell: ({ row }) => (row.original.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">معطّل</Badge>),
        },
        ...(canUpdate || canDelete
            ? [
                  {
                      id: 'actions',
                      header: '',
                      cell: ({ row }: { row: { original: DomainUser } }) => (
                          <div className="flex justify-end gap-1">
                              {canUpdate && (
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
                                      <Pencil className="size-4" />
                                  </Button>
                              )}
                              {canDelete && (
                                  <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)}>
                                      <Trash2 className="text-destructive size-4" />
                                  </Button>
                              )}
                          </div>
                      ),
                  },
              ]
            : []),
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="المستخدمون" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="المستخدمون"
                    description="إدارة المستخدمين وإسناد الأدوار والأقسام"
                    actions={
                        canCreate && (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" /> إضافة مستخدم
                            </Button>
                        )
                    }
                />
                <DataTable columns={columns} data={users} searchPlaceholder="ابحث عن مستخدم..." />
            </div>

            <FormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title={editing ? 'تعديل مستخدم' : 'إضافة مستخدم'}
                onSubmit={submit}
                loading={form.processing}
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="name">الاسم</Label>
                        <Input id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        {form.errors.name && <p className="text-destructive text-xs">{form.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">البريد الإلكتروني</Label>
                        <Input id="email" type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} dir="ltr" />
                        {form.errors.email && <p className="text-destructive text-xs">{form.errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">{editing ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</Label>
                        <Input id="password" type="password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} dir="ltr" />
                        {form.errors.password && <p className="text-destructive text-xs">{form.errors.password}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password_confirmation">تأكيد كلمة المرور</Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            value={form.data.password_confirmation}
                            onChange={(e) => form.setData('password_confirmation', e.target.value)}
                            dir="ltr"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>القسم</Label>
                        <Select value={form.data.department_id || NONE} onValueChange={(v) => form.setData('department_id', v === NONE ? '' : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="بدون (إدارة التوجيه)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>بدون (إدارة التوجيه)</SelectItem>
                                {departments.map((d) => (
                                    <SelectItem key={d.id} value={String(d.id)}>
                                        {d.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">الهاتف</Label>
                        <Input id="phone" value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} dir="ltr" />
                    </div>
                </FormSection>

                <div className="space-y-2">
                    <Label>الأدوار</Label>
                    <div className="flex flex-wrap gap-3 rounded-xl border border-border/60 p-3">
                        {roles.map((r) => (
                            <label key={r.id} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.data.role_ids.includes(r.id)} onChange={() => toggleRole(r.id)} />
                                {r.display_name}
                            </label>
                        ))}
                    </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                    حساب نشط
                </label>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف المستخدم"
                description={`سيتم حذف «${deleting?.name}». لا يمكن التراجع.`}
                loading={form.processing}
                onConfirm={confirmDelete}
            />
        </AppLayout>
    );
}
