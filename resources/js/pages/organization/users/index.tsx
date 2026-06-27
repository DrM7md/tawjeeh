import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { usePermissions } from '@/components/shared/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type DomainUser, type Role } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { BarChart3, Download, Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'المستخدمون', href: '/users' },
];

const NONE = '__none__';

const genderLabels: Record<string, string> = { male: 'ذكر', female: 'أنثى' };

interface ImportPreview {
    rows: { row: number; name: string; email: string; phone: string; department: string; gender: string; status: 'new' | 'update' | 'error'; message: string }[];
    summary: { new: number; update: number; error: number };
    total: number;
}

interface PageProps {
    users: DomainUser[];
    departments: { id: number; name: string }[];
    roles: Role[];
    canViewAllDepartments: boolean;
    userImport?: { preview: ImportPreview; token: string; originalName: string };
}

export default function UsersIndex({ users, departments, roles, canViewAllDepartments, userImport }: PageProps) {
    const { can } = usePermissions();
    const canCreate = can('users.create');
    const canUpdate = can('users.update');
    const canDelete = can('users.delete');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<DomainUser | null>(null);
    const [deleting, setDeleting] = useState<DomainUser | null>(null);
    const [tab, setTab] = useState('all');
    const [importOpen, setImportOpen] = useState(!!userImport);
    const [importing, setImporting] = useState(false);

    const hasUnassigned = useMemo(() => users.some((u) => !u.department_id), [users]);

    const filteredUsers = useMemo(() => {
        if (!canViewAllDepartments || tab === 'all') return users;
        if (tab === NONE) return users.filter((u) => !u.department_id);
        return users.filter((u) => String(u.department_id) === tab);
    }, [users, tab, canViewAllDepartments]);

    const form = useForm<{
        name: string;
        email: string;
        password: string;
        password_confirmation: string;
        department_id: string;
        phone: string;
        gender: string;
        is_active: boolean;
        role_ids: number[];
    }>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        department_id: '',
        phone: '',
        gender: '',
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
            gender: u.gender ?? '',
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

    const uploadImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        router.post(
            '/users-import/preview',
            { file },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: false,
                onError: (errors) => toast.error(errors.file ?? 'تعذّر قراءة الملف'),
            },
        );
        e.target.value = '';
    };

    const confirmImport = () => {
        if (!userImport) return;
        setImporting(true);
        router.post(
            '/users-import',
            { token: userImport.token, original_name: userImport.originalName },
            {
                onSuccess: () => {
                    setImportOpen(false);
                    toast.success('تم استيراد الموجّهين');
                },
                onFinish: () => setImporting(false),
            },
        );
    };

    const columns: ColumnDef<DomainUser>[] = [
        {
            accessorKey: 'name',
            header: 'الاسم',
            cell: ({ row }) => (
                <Link href={`/users/${row.original.id}`} className="font-medium text-primary hover:underline">
                    {row.original.name}
                </Link>
            ),
        },
        { accessorKey: 'email', header: 'البريد' },
        {
            accessorKey: 'gender',
            header: 'النوع',
            cell: ({ row }) => (row.original.gender ? genderLabels[row.original.gender] : '—'),
        },
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
        {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: DomainUser } }) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/users/${row.original.id}`} aria-label="عرض الملف">
                            <Eye className="size-4" />
                        </Link>
                    </Button>
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
    ];

    const filters: DataTableFilter<DomainUser>[] = [
        ...(roles.length
            ? [
                  {
                      id: 'role',
                      label: 'الدور',
                      options: roles.map((r) => ({ value: r.display_name, label: r.display_name })),
                      getValue: (u: DomainUser) => u.roles?.map((r) => r.display_name) ?? [],
                  },
              ]
            : []),
        {
            id: 'gender',
            label: 'النوع',
            options: [
                { value: 'male', label: 'ذكر' },
                { value: 'female', label: 'أنثى' },
            ],
            getValue: (u: DomainUser) => u.gender ?? '',
        },
        {
            id: 'status',
            label: 'الحالة',
            options: [
                { value: 'active', label: 'نشط' },
                { value: 'inactive', label: 'معطّل' },
            ],
            getValue: (u: DomainUser) => (u.is_active ? 'active' : 'inactive'),
        },
    ];

    const renderCard = (u: DomainUser) => (
        <Card className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
                <Link href={`/users/${u.id}`} className="text-primary font-semibold hover:underline">
                    {u.name}
                </Link>
                {u.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">معطّل</Badge>}
            </div>
            <p className="text-muted-foreground text-sm" dir="ltr">
                {u.email}
            </p>
            <div className="text-sm">
                <span className="text-muted-foreground text-xs">القسم: </span>
                <span>{u.department?.name ?? '—'}</span>
            </div>
            <div className="text-sm">
                <span className="text-muted-foreground text-xs">النوع: </span>
                <span>{u.gender ? genderLabels[u.gender] : '—'}</span>
            </div>
            <div className="flex flex-wrap gap-1">
                {u.roles?.length ? u.roles.map((r) => <Badge key={r.id} variant="secondary">{r.display_name}</Badge>) : null}
            </div>
            <div className="mt-auto flex justify-end gap-1 border-t border-border/60 pt-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/users/${u.id}`} aria-label="عرض الملف">
                        <Eye className="size-4" />
                    </Link>
                </Button>
                {canUpdate && (
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="size-4" />
                    </Button>
                )}
                {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(u)}>
                        <Trash2 className="text-destructive size-4" />
                    </Button>
                )}
            </div>
        </Card>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="المستخدمون" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="المستخدمون"
                    description="إدارة المستخدمين وإسناد الأدوار والأقسام"
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" asChild>
                                <Link href="/users-statistics">
                                    <BarChart3 className="size-4" /> إحصائيات
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <a href={`/users-export?department=${encodeURIComponent(tab)}`}>
                                    <Download className="size-4" /> تصدير Excel
                                </a>
                            </Button>
                            {canCreate && (
                                <Button variant="outline" onClick={() => setImportOpen(true)}>
                                    <Upload className="size-4" /> استيراد
                                </Button>
                            )}
                            {canCreate && (
                                <Button onClick={openCreate}>
                                    <Plus className="size-4" /> إضافة مستخدم
                                </Button>
                            )}
                        </div>
                    }
                />

                {canViewAllDepartments && (
                    <Tabs value={tab} onValueChange={setTab}>
                        <TabsList>
                            <TabsTrigger value="all">الكل ({users.length})</TabsTrigger>
                            {departments.map((d) => {
                                const count = users.filter((u) => u.department_id === d.id).length;
                                return (
                                    <TabsTrigger key={d.id} value={String(d.id)}>
                                        {d.name} ({count})
                                    </TabsTrigger>
                                );
                            })}
                            {hasUnassigned && (
                                <TabsTrigger value={NONE}>
                                    إدارة التوجيه ({users.filter((u) => !u.department_id).length})
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </Tabs>
                )}

                <DataTable
                    columns={columns}
                    data={filteredUsers}
                    searchPlaceholder="ابحث عن مستخدم..."
                    storageKey="view:users"
                    filters={filters}
                    renderCard={renderCard}
                />
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
                    <div className="space-y-2">
                        <Label>النوع</Label>
                        <Select value={form.data.gender || NONE} onValueChange={(v) => form.setData('gender', v === NONE ? '' : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="غير محدد" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>غير محدد</SelectItem>
                                <SelectItem value="male">ذكر</SelectItem>
                                <SelectItem value="female">أنثى</SelectItem>
                            </SelectContent>
                        </Select>
                        {form.errors.gender && <p className="text-destructive text-xs">{form.errors.gender}</p>}
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

            <FormDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                title="استيراد الموجّهين"
                description="نزّل القالب، عبّئه، ثم ارفعه لمعاينة النتائج قبل التأكيد."
                hideFooter
            >
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" asChild>
                            <a href="/users-template">
                                <Download className="size-4" /> تنزيل القالب
                            </a>
                        </Button>
                        <Label
                            htmlFor="import-file"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-medium"
                        >
                            <Upload className="size-4" /> اختر ملف Excel
                        </Label>
                        <input id="import-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={uploadImport} />
                    </div>

                    {userImport && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2 text-sm">
                                <Badge>جديد: {userImport.preview.summary.new}</Badge>
                                <Badge variant="secondary">تحديث: {userImport.preview.summary.update}</Badge>
                                <Badge variant={userImport.preview.summary.error > 0 ? 'destructive' : 'secondary'}>
                                    أخطاء: {userImport.preview.summary.error}
                                </Badge>
                                <span className="text-muted-foreground self-center">الملف: {userImport.originalName}</span>
                            </div>

                            <div className="max-h-64 overflow-auto rounded-xl border border-border/60">
                                <table className="w-full text-sm">
                                    <thead className="bg-primary/[0.12] text-primary sticky top-0 border-b-2 border-primary/30 font-bold">
                                        <tr>
                                            <th className="p-2 text-right">#</th>
                                            <th className="p-2 text-right">الاسم</th>
                                            <th className="p-2 text-right">البريد</th>
                                            <th className="p-2 text-right">القسم</th>
                                            <th className="p-2 text-right">النوع</th>
                                            <th className="p-2 text-right">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {userImport.preview.rows.map((r) => (
                                            <tr key={r.row} className="border-t border-border/40">
                                                <td className="p-2">{r.row}</td>
                                                <td className="p-2">{r.name || '—'}</td>
                                                <td className="p-2" dir="ltr">{r.email || '—'}</td>
                                                <td className="p-2">{r.department || '—'}</td>
                                                <td className="p-2">{r.gender || '—'}</td>
                                                <td className="p-2">
                                                    {r.status === 'error' ? (
                                                        <span className="text-destructive">{r.message}</span>
                                                    ) : (
                                                        <Badge variant={r.status === 'new' ? 'default' : 'secondary'}>
                                                            {r.status === 'new' ? 'جديد' : 'تحديث'}
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                                    إلغاء
                                </Button>
                                <Button
                                    onClick={confirmImport}
                                    disabled={importing || userImport.preview.summary.new + userImport.preview.summary.update === 0}
                                >
                                    تأكيد الاستيراد
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
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
