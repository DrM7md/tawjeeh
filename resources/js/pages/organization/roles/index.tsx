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
import { type BreadcrumbItem, type Role } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الأدوار والصلاحيات', href: '/roles' },
];

type PermissionGroups = Record<string, { label: string; permissions: Record<string, string> }>;
const levelLabels: Record<number, string> = { 1: 'إدارة التوجيه', 2: 'رئيس قسم', 3: 'موجه' };

export default function RolesIndex({ roles, permissionGroups }: { roles: Role[]; permissionGroups: PermissionGroups }) {
    const { can } = usePermissions();
    const canManage = can('roles.manage');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Role | null>(null);
    const [deleting, setDeleting] = useState<Role | null>(null);

    const form = useForm<{ name: string; display_name: string; level: number; permissions: string[] }>({
        name: '',
        display_name: '',
        level: 3,
        permissions: [],
    });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEdit = (r: Role) => {
        setEditing(r);
        form.clearErrors();
        form.setData({ name: r.name, display_name: r.display_name, level: r.level, permissions: r.permissions ?? [] });
        setDialogOpen(true);
    };

    const togglePermission = (key: string) => {
        const set = new Set(form.data.permissions);
        set.has(key) ? set.delete(key) : set.add(key);
        form.setData('permissions', Array.from(set));
    };

    const toggleGroup = (groupKeys: string[], allSelected: boolean) => {
        const set = new Set(form.data.permissions);
        groupKeys.forEach((k) => (allSelected ? set.delete(k) : set.add(k)));
        form.setData('permissions', Array.from(set));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            onSuccess: () => {
                setDialogOpen(false);
                toast.success(editing ? 'تم تحديث الدور' : 'تم إنشاء الدور');
            },
        };
        if (editing) form.put(`/roles/${editing.id}`, opts);
        else form.post('/roles', opts);
    };

    const confirmDelete = () => {
        if (!deleting) return;
        form.delete(`/roles/${deleting.id}`, {
            onSuccess: () => {
                setDeleting(null);
                toast.success('تم حذف الدور');
            },
        });
    };

    const columns: ColumnDef<Role>[] = [
        {
            accessorKey: 'display_name',
            header: 'الدور',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-primary size-4" />
                    <span className="font-medium">{row.original.display_name}</span>
                    {row.original.is_system && <Badge variant="secondary">نظام</Badge>}
                </div>
            ),
        },
        { accessorKey: 'level', header: 'المستوى', cell: ({ row }) => levelLabels[row.original.level] ?? row.original.level },
        {
            id: 'perms',
            header: 'عدد الصلاحيات',
            cell: ({ row }) => <span className="tnum">{row.original.permissions?.length ?? 0}</span>,
        },
        { accessorKey: 'users_count', header: 'المستخدمون', cell: ({ row }) => <span className="tnum">{row.original.users_count ?? 0}</span> },
        ...(canManage
            ? [
                  {
                      id: 'actions',
                      header: '',
                      cell: ({ row }: { row: { original: Role } }) => (
                          <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
                                  <Pencil className="size-4" />
                              </Button>
                              {!row.original.is_system && (
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
            <Head title="الأدوار والصلاحيات" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="الأدوار والصلاحيات"
                    description="تعريف الأدوار وضبط صلاحيات كل دور"
                    actions={
                        canManage && (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" /> دور جديد
                            </Button>
                        )
                    }
                />
                <DataTable columns={columns} data={roles} searchPlaceholder="ابحث عن دور..." />
            </div>

            <FormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title={editing ? `تعديل: ${editing.display_name}` : 'دور جديد'}
                onSubmit={submit}
                loading={form.processing}
                className="sm:max-w-[760px]"
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="display_name">الاسم المعروض</Label>
                        <Input id="display_name" value={form.data.display_name} onChange={(e) => form.setData('display_name', e.target.value)} />
                        {form.errors.display_name && <p className="text-destructive text-xs">{form.errors.display_name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">المعرّف البرمجي (إنجليزي)</Label>
                        <Input
                            id="name"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            dir="ltr"
                            disabled={editing?.is_system}
                            placeholder="custom_role"
                        />
                        {form.errors.name && <p className="text-destructive text-xs">{form.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>المستوى الإداري</Label>
                        <Select value={String(form.data.level)} onValueChange={(v) => form.setData('level', Number(v))} disabled={editing?.is_system}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">إدارة التوجيه</SelectItem>
                                <SelectItem value="2">رئيس قسم</SelectItem>
                                <SelectItem value="3">موجه</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </FormSection>

                <div className="space-y-3">
                    <Label>الصلاحيات</Label>
                    <div className="max-h-[40vh] space-y-3 overflow-y-auto rounded-xl border border-border/60 p-3">
                        {Object.entries(permissionGroups).map(([groupKey, group]) => {
                            const keys = Object.keys(group.permissions);
                            const allSelected = keys.every((k) => form.data.permissions.includes(k));
                            return (
                                <div key={groupKey} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold">{group.label}</span>
                                        <button type="button" className="text-primary text-xs" onClick={() => toggleGroup(keys, allSelected)}>
                                            {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {Object.entries(group.permissions).map(([key, label]) => (
                                            <label key={key} className="flex items-center gap-2 text-sm">
                                                <input type="checkbox" checked={form.data.permissions.includes(key)} onChange={() => togglePermission(key)} />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف الدور"
                description={`سيتم حذف «${deleting?.display_name}». لا يمكن التراجع.`}
                loading={form.processing}
                onConfirm={confirmDelete}
            />
        </AppLayout>
    );
}
