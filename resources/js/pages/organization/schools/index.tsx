import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { ImportDialog } from '@/components/shared/import-dialog';
import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { usePermissions } from '@/components/shared/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type ImportData, type School, type Stage } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { BarChart3, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'المدارس', href: '/schools' },
];

const NONE = '__none__';
const genderLabels: Record<string, string> = { boys: 'بنين', girls: 'بنات', mixed: 'مشترك' };

interface PageProps {
    schools: School[];
    stages: Stage[];
    schoolImport?: ImportData;
}

export default function SchoolsIndex({ schools, stages, schoolImport }: PageProps) {
    const { can } = usePermissions();
    const canManage = can('schools.manage');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<School | null>(null);
    const [deleting, setDeleting] = useState<School | null>(null);
    const [importOpen, setImportOpen] = useState(!!schoolImport);

    // افتح نافذة الاستيراد تلقائيًا عند وصول معاينة من الخادم
    useEffect(() => {
        if (schoolImport) setImportOpen(true);
    }, [schoolImport]);

    const form = useForm({ name: '', stage_id: '', gender: '', zone: '', email: '', principal: '', is_active: true });

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
            email: s.email ?? '',
            principal: s.principal?.name ?? '',
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
        {
            accessorKey: 'name',
            header: 'المدرسة',
            cell: ({ row }) => (
                <Link href={`/schools/${row.original.id}`} className="text-primary font-medium hover:underline">
                    {row.original.name}
                </Link>
            ),
        },
        { id: 'stage', header: 'المرحلة', cell: ({ row }) => row.original.stage?.name ?? '—' },
        { accessorKey: 'gender', header: 'النوع', cell: ({ row }) => (row.original.gender ? genderLabels[row.original.gender] : '—') },
        { id: 'principal', header: 'مدير المدرسة', cell: ({ row }) => row.original.principal?.name ?? '—' },
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

    const filters: DataTableFilter<School>[] = [
        {
            id: 'stage',
            label: 'المرحلة',
            options: stages.map((s) => ({ value: s.name, label: s.name })),
            getValue: (s) => s.stage?.name ?? '',
        },
        {
            id: 'gender',
            label: 'النوع',
            options: [
                { value: 'boys', label: 'بنين' },
                { value: 'girls', label: 'بنات' },
                { value: 'mixed', label: 'مشترك' },
            ],
            getValue: (s) => s.gender ?? '',
        },
        {
            id: 'status',
            label: 'الحالة',
            options: [
                { value: 'active', label: 'نشط' },
                { value: 'inactive', label: 'معطّل' },
            ],
            getValue: (s) => (s.is_active ? 'active' : 'inactive'),
        },
    ];

    const renderCard = (s: School) => (
        <Card className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
                <Link href={`/schools/${s.id}`} className="text-primary font-semibold hover:underline">
                    {s.name}
                </Link>
                {s.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">معطّل</Badge>}
            </div>
            <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="flex flex-col">
                    <dt className="text-xs">المرحلة</dt>
                    <dd className="text-foreground">{s.stage?.name ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">النوع</dt>
                    <dd className="text-foreground">{s.gender ? genderLabels[s.gender] : '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">مدير المدرسة</dt>
                    <dd className="text-foreground">{s.principal?.name ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">المنطقة</dt>
                    <dd className="text-foreground">{s.zone || '—'}</dd>
                </div>
            </dl>
            {canManage && (
                <div className="mt-auto flex justify-end gap-1 border-t border-border/60 pt-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(s)}>
                        <Trash2 className="text-destructive size-4" />
                    </Button>
                </div>
            )}
        </Card>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="المدارس" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="المدارس"
                    description="إدارة بيانات المدارس"
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" asChild>
                                <Link href="/schools-statistics">
                                    <BarChart3 className="size-4" /> إحصائيات
                                </Link>
                            </Button>
                            {canManage && (
                                <>
                                    <Button variant="outline" asChild>
                                        <a href="/schools-export">
                                            <Download className="size-4" /> تصدير
                                        </a>
                                    </Button>
                                    <Button variant="outline" onClick={() => setImportOpen(true)}>
                                        <Upload className="size-4" /> استيراد المدارس
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link href="/roster-import">
                                            <Upload className="size-4" /> استيراد المعلمين
                                        </Link>
                                    </Button>
                                    <Button onClick={openCreate}>
                                        <Plus className="size-4" /> إضافة مدرسة
                                    </Button>
                                </>
                            )}
                        </div>
                    }
                />
                <DataTable
                    columns={columns}
                    data={schools}
                    searchPlaceholder="ابحث عن مدرسة..."
                    storageKey="view:schools"
                    filters={filters}
                    renderCard={renderCard}
                />
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
                    <div className="space-y-2">
                        <Label htmlFor="email">إيميل المدرسة</Label>
                        <Input id="email" type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="principal">مدير المدرسة</Label>
                        <Input id="principal" value={form.data.principal} onChange={(e) => form.setData('principal', e.target.value)} />
                        <p className="text-muted-foreground text-xs">يُسجَّل لمدير العام الدراسي المختار حاليًا</p>
                    </div>
                </FormSection>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                    مدرسة نشطة
                </label>
            </FormDialog>

            <ImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                title="استيراد المدارس"
                description="ارفع ملف Excel بالأعمدة: اسم المدرسة، المرحلة، النوع، إيميل المدرسة، مدير المدرسة"
                templateUrl="/schools-template"
                previewUrl="/schools-import/preview"
                storeUrl="/schools-import"
                baseUrl="/schools"
                data={schoolImport}
                columns={[
                    { key: 'name', label: 'المدرسة' },
                    { key: 'stage', label: 'المرحلة' },
                    { key: 'gender', label: 'النوع' },
                    { key: 'principal', label: 'المدير' },
                ]}
            />

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
