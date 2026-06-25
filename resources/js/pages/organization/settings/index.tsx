import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Stage, type TeacherClassification } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'إعدادات الهيكل', href: '/organization-settings' },
];

export default function OrgSettingsIndex({ stages, classifications }: { stages: Stage[]; classifications: TeacherClassification[] }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="إعدادات الهيكل" />
            <div className="flex flex-col gap-8 p-4 md:p-6">
                <PageHeader title="إعدادات الهيكل" description="المراحل الدراسية وتصنيفات المعلمين" />
                <StagesSection stages={stages} />
                <ClassificationsSection classifications={classifications} />
            </div>
        </AppLayout>
    );
}

/* ===================== المراحل ===================== */
function StagesSection({ stages }: { stages: Stage[] }) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Stage | null>(null);
    const [deleting, setDeleting] = useState<Stage | null>(null);
    const form = useForm({ name: '', sort_order: 0 });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setOpen(true);
    };
    const openEdit = (s: Stage) => {
        setEditing(s);
        form.clearErrors();
        form.setData({ name: s.name, sort_order: s.sort_order });
        setOpen(true);
    };
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { onSuccess: () => { setOpen(false); toast.success('تم الحفظ'); } };
        editing ? form.put(`/stages/${editing.id}`, opts) : form.post('/stages', opts);
    };

    const columns: ColumnDef<Stage>[] = [
        { accessorKey: 'name', header: 'المرحلة', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { accessorKey: 'sort_order', header: 'الترتيب', cell: ({ row }) => <span className="tnum">{row.original.sort_order}</span> },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)}><Trash2 className="text-destructive size-4" /></Button>
                </div>
            ),
        },
    ];

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">المراحل الدراسية</h2>
                <Button onClick={openCreate}><Plus className="size-4" /> إضافة مرحلة</Button>
            </div>
            <DataTable columns={columns} data={stages} searchable={false} />

            <FormDialog open={open} onOpenChange={setOpen} title={editing ? 'تعديل مرحلة' : 'إضافة مرحلة'} onSubmit={submit} loading={form.processing}>
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="s_name">الاسم</Label>
                        <Input id="s_name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        {form.errors.name && <p className="text-destructive text-xs">{form.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="s_order">الترتيب</Label>
                        <Input id="s_order" type="number" value={form.data.sort_order} onChange={(e) => form.setData('sort_order', Number(e.target.value))} />
                    </div>
                </FormSection>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف المرحلة"
                description={`سيتم حذف «${deleting?.name}».`}
                loading={form.processing}
                onConfirm={() => deleting && form.delete(`/stages/${deleting.id}`, { onSuccess: () => { setDeleting(null); toast.success('تم الحذف'); } })}
            />
        </section>
    );
}

/* ===================== التصنيفات ===================== */
function ClassificationsSection({ classifications }: { classifications: TeacherClassification[] }) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<TeacherClassification | null>(null);
    const [deleting, setDeleting] = useState<TeacherClassification | null>(null);
    const form = useForm({ name: '', required_visits: 1, color: '#34C759' });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setOpen(true);
    };
    const openEdit = (c: TeacherClassification) => {
        setEditing(c);
        form.clearErrors();
        form.setData({ name: c.name, required_visits: c.required_visits, color: c.color ?? '#34C759' });
        setOpen(true);
    };
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { onSuccess: () => { setOpen(false); toast.success('تم الحفظ'); } };
        editing ? form.put(`/classifications/${editing.id}`, opts) : form.post('/classifications', opts);
    };

    const columns: ColumnDef<TeacherClassification>[] = [
        {
            accessorKey: 'name',
            header: 'التصنيف',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.original.color && <span className="size-3 rounded-full" style={{ backgroundColor: row.original.color }} />}
                    <span className="font-medium">{row.original.name}</span>
                </div>
            ),
        },
        { accessorKey: 'required_visits', header: 'الزيارات المطلوبة', cell: ({ row }) => <span className="tnum">{row.original.required_visits}</span> },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)}><Trash2 className="text-destructive size-4" /></Button>
                </div>
            ),
        },
    ];

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">تصنيفات المعلمين</h2>
                <Button onClick={openCreate}><Plus className="size-4" /> إضافة تصنيف</Button>
            </div>
            <DataTable columns={columns} data={classifications} searchable={false} />

            <FormDialog open={open} onOpenChange={setOpen} title={editing ? 'تعديل تصنيف' : 'إضافة تصنيف'} onSubmit={submit} loading={form.processing}>
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="c_name">الاسم</Label>
                        <Input id="c_name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        {form.errors.name && <p className="text-destructive text-xs">{form.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="c_visits">الزيارات المطلوبة</Label>
                        <Input id="c_visits" type="number" min={1} max={10} value={form.data.required_visits} onChange={(e) => form.setData('required_visits', Number(e.target.value))} />
                        {form.errors.required_visits && <p className="text-destructive text-xs">{form.errors.required_visits}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="c_color">اللون</Label>
                        <Input id="c_color" type="color" value={form.data.color} onChange={(e) => form.setData('color', e.target.value)} className="h-10 w-20 p-1" />
                    </div>
                </FormSection>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف التصنيف"
                description={`سيتم حذف «${deleting?.name}».`}
                loading={form.processing}
                onConfirm={() => deleting && form.delete(`/classifications/${deleting.id}`, { onSuccess: () => { setDeleting(null); toast.success('تم الحذف'); } })}
            />
        </section>
    );
}
