import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type Grade, type Stage, type TeacherClassification } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { ClipboardCheck, GraduationCap, Layers, type LucideIcon, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'إعدادات الهيكل', href: '/organization-settings' },
];

export default function OrgSettingsIndex({
    stages,
    classifications,
    grades,
}: Readonly<{ stages: Stage[]; classifications: TeacherClassification[]; grades: Grade[] }>) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="إعدادات الهيكل" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="إعدادات الهيكل" description="المراحل والصفوف وتصنيفات المعلمين واستمارة التحكيم" />

                {/* لوحة بطاقات شبكية — عدّة جداول في الصف الواحد، تتمدّد تلقائيًا مع زيادة الأقسام */}
                <div className="grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    <StagesSection stages={stages} />
                    <GradesSection grades={grades} stages={stages} />
                    <ReviewFormCard />
                    <ClassificationsSection classifications={classifications} />
                </div>
            </div>
        </AppLayout>
    );
}

/* ===================== استمارة التحكيم (محرّر هرمي مستقل) ===================== */
function ReviewFormCard() {
    return (
        <section className="flex h-full flex-col gap-3">
            <div className="flex items-center gap-2.5">
                <span className={cn('flex size-9 items-center justify-center rounded-xl', ACCENTS.amber)}>
                    <ClipboardCheck className="size-4.5" />
                </span>
                <div className="leading-tight">
                    <h2 className="font-semibold">استمارة التحكيم</h2>
                    <p className="text-muted-foreground text-xs">المجالات والبنود والمؤشرات</p>
                </div>
            </div>
            <div className="border-border/60 bg-muted/20 flex flex-1 flex-col items-start justify-between gap-3 rounded-xl border p-4">
                <p className="text-muted-foreground text-sm">حرّر هيكل استمارة تحكيم الاختبارات: المجالات ← البنود ← المؤشرات، كما يراها المحكّم.</p>
                <Button size="sm" variant="outline" asChild>
                    <Link href="/review-form">
                        <Pencil className="size-4" /> تحرير الاستمارة
                    </Link>
                </Button>
            </div>
        </section>
    );
}

/* ===================== بطاقة قسم موحّدة ===================== */
const ACCENTS: Record<string, string> = {
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

function SectionCard({
    title,
    icon: Icon,
    accent,
    count,
    addLabel,
    onAdd,
    children,
}: Readonly<{
    title: string;
    icon: LucideIcon;
    accent: keyof typeof ACCENTS;
    count: number;
    addLabel: string;
    onAdd: () => void;
    children: React.ReactNode;
}>) {
    return (
        <section className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <span className={cn('flex size-9 items-center justify-center rounded-xl', ACCENTS[accent])}>
                        <Icon className="size-4.5" />
                    </span>
                    <div className="leading-tight">
                        <h2 className="font-semibold">{title}</h2>
                        <p className="text-muted-foreground tnum text-xs">{count} عنصر</p>
                    </div>
                </div>
                <Button size="sm" variant="outline" onClick={onAdd}>
                    <Plus className="size-4" /> {addLabel}
                </Button>
            </div>
            {children}
        </section>
    );
}

/* ===================== المراحل ===================== */
function StagesSection({ stages }: { stages: Stage[] }) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Stage | null>(null);
    const [deleting, setDeleting] = useState<Stage | null>(null);
    const form = useForm({ name: '' });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setOpen(true);
    };
    const openEdit = (s: Stage) => {
        setEditing(s);
        form.clearErrors();
        form.setData({ name: s.name });
        setOpen(true);
    };
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            onSuccess: () => {
                setOpen(false);
                toast.success('تم الحفظ');
            },
        };
        editing ? form.put(`/stages/${editing.id}`, opts) : form.post('/stages', opts);
    };

    const columns: ColumnDef<Stage>[] = [
        { accessorKey: 'name', header: 'المرحلة', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
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
    ];

    return (
        <SectionCard title="المراحل الدراسية" icon={Layers} accent="sky" count={stages.length} addLabel="إضافة مرحلة" onAdd={openCreate}>
            <DataTable columns={columns} data={stages} searchable={false} pageSize={5} />

            <FormDialog
                open={open}
                onOpenChange={setOpen}
                title={editing ? 'تعديل مرحلة' : 'إضافة مرحلة'}
                onSubmit={submit}
                loading={form.processing}
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="s_name">الاسم</Label>
                        <Input id="s_name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        {form.errors.name && <p className="text-destructive text-xs">{form.errors.name}</p>}
                    </div>
                </FormSection>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف المرحلة"
                description={`سيتم حذف «${deleting?.name}».`}
                loading={form.processing}
                onConfirm={() =>
                    deleting &&
                    form.delete(`/stages/${deleting.id}`, {
                        onSuccess: () => {
                            setDeleting(null);
                            toast.success('تم الحذف');
                        },
                    })
                }
            />
        </SectionCard>
    );
}

/* ===================== الصفوف ===================== */
const NONE = '__none__';

function GradesSection({ grades, stages }: Readonly<{ grades: Grade[]; stages: Stage[] }>) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Grade | null>(null);
    const [deleting, setDeleting] = useState<Grade | null>(null);
    const form = useForm<{ name: string; stage_id: string; tracks: string[] }>({
        name: '',
        stage_id: '',
        tracks: [],
    });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setOpen(true);
    };
    const openEdit = (g: Grade) => {
        setEditing(g);
        form.clearErrors();
        form.setData({
            name: g.name,
            stage_id: g.stage_id ? String(g.stage_id) : '',
            tracks: (g.tracks ?? []).map((t) => t.name),
        });
        setOpen(true);
    };
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            onSuccess: () => {
                setOpen(false);
                toast.success('تم الحفظ');
            },
        };
        if (editing) form.put(`/grades/${editing.id}`, opts);
        else form.post('/grades', opts);
    };

    const setTrack = (i: number, value: string) =>
        form.setData(
            'tracks',
            form.data.tracks.map((t, idx) => (idx === i ? value : t)),
        );
    const addTrack = () => form.setData('tracks', [...form.data.tracks, '']);
    const removeTrack = (i: number) =>
        form.setData(
            'tracks',
            form.data.tracks.filter((_, idx) => idx !== i),
        );

    const columns: ColumnDef<Grade>[] = [
        { accessorKey: 'name', header: 'الصف', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { id: 'stage', header: 'المرحلة', cell: ({ row }) => row.original.stage?.name ?? '—' },
        {
            id: 'tracks',
            header: 'المسارات',
            cell: ({ row }) =>
                row.original.tracks?.length ? (
                    <div className="flex flex-wrap gap-1">
                        {row.original.tracks.map((t) => (
                            <Badge key={t.id} variant="secondary">
                                {t.name}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
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
    ];

    return (
        <SectionCard title="الصفوف الدراسية" icon={GraduationCap} accent="primary" count={grades.length} addLabel="إضافة صف" onAdd={openCreate}>
            <DataTable columns={columns} data={grades} searchable={false} pageSize={5} />

            <FormDialog open={open} onOpenChange={setOpen} title={editing ? 'تعديل صف' : 'إضافة صف'} onSubmit={submit} loading={form.processing}>
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="g_name">الاسم</Label>
                        <Input id="g_name" placeholder="الحادي عشر" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
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
                </FormSection>

                {/* المسارات: تظهر للصف عند إضافتها (مثل الحادي عشر/الثاني عشر) — اتركها فارغة للصفوف بلا مسارات */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>المسارات (اختياري)</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={addTrack}>
                            <Plus className="size-3.5" /> مسار
                        </Button>
                    </div>
                    {form.data.tracks.length === 0 ? (
                        <p className="text-muted-foreground text-xs">بدون مسارات — لن يُطلب المسار عند تحكيم هذا الصف.</p>
                    ) : (
                        <div className="space-y-2">
                            {form.data.tracks.map((t, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <Input placeholder="عام / أدبي / علمي / تكنولوجي" value={t} onChange={(e) => setTrack(i, e.target.value)} />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTrack(i)}>
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف الصف"
                description={`سيتم حذف «${deleting?.name}» ومساراته.`}
                loading={form.processing}
                onConfirm={() =>
                    deleting &&
                    form.delete(`/grades/${deleting.id}`, {
                        onSuccess: () => {
                            setDeleting(null);
                            toast.success('تم الحذف');
                        },
                    })
                }
            />
        </SectionCard>
    );
}

/* ===================== التصنيفات ===================== */
function ClassificationsSection({ classifications }: { classifications: TeacherClassification[] }) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<TeacherClassification | null>(null);
    const [deleting, setDeleting] = useState<TeacherClassification | null>(null);
    const form = useForm<{
        name: string;
        required_visits: number;
        required_forms: number;
        min_percent: number;
        max_percent: number;
        is_default_for_new: boolean;
        color: string;
    }>({
        name: '',
        required_visits: 1,
        required_forms: 1,
        min_percent: 0,
        max_percent: 100,
        is_default_for_new: false,
        color: '#34C759',
    });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setOpen(true);
    };
    const openEdit = (c: TeacherClassification) => {
        setEditing(c);
        form.clearErrors();
        form.setData({
            name: c.name,
            required_visits: c.required_visits,
            required_forms: c.required_forms ?? 1,
            min_percent: c.min_percent ?? 0,
            max_percent: c.max_percent ?? 100,
            is_default_for_new: c.is_default_for_new ?? false,
            color: c.color ?? '#34C759',
        });
        setOpen(true);
    };
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            onSuccess: () => {
                setOpen(false);
                toast.success('تم الحفظ');
            },
        };
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
        { accessorKey: 'required_visits', header: 'الزيارات', cell: ({ row }) => <span className="tnum">{row.original.required_visits}</span> },
        { id: 'required_forms', header: 'الاستمارات', cell: ({ row }) => <span className="tnum">{row.original.required_forms ?? '—'}</span> },
        {
            id: 'band',
            header: 'النطاق %',
            cell: ({ row }) =>
                row.original.min_percent != null && row.original.max_percent != null ? (
                    <span className="tnum">
                        {row.original.min_percent}–{row.original.max_percent}
                    </span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
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
    ];

    return (
        <SectionCard title="تصنيفات المعلمين" icon={Users} accent="emerald" count={classifications.length} addLabel="إضافة تصنيف" onAdd={openCreate}>
            <DataTable columns={columns} data={classifications} searchable={false} pageSize={5} />

            <FormDialog
                open={open}
                onOpenChange={setOpen}
                title={editing ? 'تعديل تصنيف' : 'إضافة تصنيف'}
                onSubmit={submit}
                loading={form.processing}
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="c_name">الاسم</Label>
                        <Input id="c_name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        {form.errors.name && <p className="text-destructive text-xs">{form.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="c_visits">الزيارات المطلوبة</Label>
                        <Input
                            id="c_visits"
                            type="number"
                            min={1}
                            max={10}
                            value={form.data.required_visits}
                            onChange={(e) => form.setData('required_visits', Number(e.target.value))}
                        />
                        {form.errors.required_visits && <p className="text-destructive text-xs">{form.errors.required_visits}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="c_forms">الاستمارات المطلوبة</Label>
                        <Input
                            id="c_forms"
                            type="number"
                            min={0}
                            max={10}
                            value={form.data.required_forms}
                            onChange={(e) => form.setData('required_forms', Number(e.target.value))}
                        />
                        {form.errors.required_forms && <p className="text-destructive text-xs">{form.errors.required_forms}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="c_min">أدنى نسبة (%)</Label>
                        <Input
                            id="c_min"
                            type="number"
                            min={0}
                            max={100}
                            value={form.data.min_percent}
                            onChange={(e) => form.setData('min_percent', Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="c_max">أعلى نسبة (%)</Label>
                        <Input
                            id="c_max"
                            type="number"
                            min={0}
                            max={100}
                            value={form.data.max_percent}
                            onChange={(e) => form.setData('max_percent', Number(e.target.value))}
                        />
                        {form.errors.max_percent && <p className="text-destructive text-xs">{form.errors.max_percent}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="c_color">اللون</Label>
                        <Input
                            id="c_color"
                            type="color"
                            value={form.data.color}
                            onChange={(e) => form.setData('color', e.target.value)}
                            className="h-10 w-20 p-1"
                        />
                    </div>
                    <label className="flex items-center gap-2 self-end text-sm">
                        <input
                            type="checkbox"
                            checked={form.data.is_default_for_new}
                            onChange={(e) => form.setData('is_default_for_new', e.target.checked)}
                        />
                        فئة المعلم الجديد آليًا
                    </label>
                </FormSection>
            </FormDialog>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف التصنيف"
                description={`سيتم حذف «${deleting?.name}».`}
                loading={form.processing}
                onConfirm={() =>
                    deleting &&
                    form.delete(`/classifications/${deleting.id}`, {
                        onSuccess: () => {
                            setDeleting(null);
                            toast.success('تم الحذف');
                        },
                    })
                }
            />
        </SectionCard>
    );
}
