import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { usePermissions } from '@/components/shared/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type AcademicYear, type BreadcrumbItem, type Semester } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Archive, CheckCircle2, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الأعوام الدراسية', href: '/academic' },
];

const yearStatusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    active: { label: 'نشط', variant: 'default' },
    closed: { label: 'مغلق', variant: 'secondary' },
    archived: { label: 'أرشيف', variant: 'destructive' },
};

const semStatus: Record<string, string> = { not_started: 'لم يبدأ', active: 'نشط', ended: 'منتهٍ', closed: 'مغلق' };

export default function AcademicIndex({ years }: { years: AcademicYear[] }) {
    const { can } = usePermissions();
    const canManage = can('academic.manage');

    const [yearDialog, setYearDialog] = useState(false);
    const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
    const [semDialog, setSemDialog] = useState(false);
    const [editingSem, setEditingSem] = useState<Semester | null>(null);
    const [semYearId, setSemYearId] = useState<number | null>(null);
    const [confirm, setConfirm] = useState<{ url: string; title: string; desc: string; destructive?: boolean } | null>(null);

    const yearForm = useForm({ name: '', start_date: '', end_date: '', generate_semesters: true });
    const semForm = useForm({ academic_year_id: 0, name: '', start_date: '', end_date: '' });

    const action = (url: string, msg: string) => router.post(url, {}, { preserveScroll: true, onSuccess: () => toast.success(msg) });

    /* ---- Year ---- */
    const openCreateYear = () => {
        setEditingYear(null);
        yearForm.reset();
        yearForm.clearErrors();
        setYearDialog(true);
    };
    const openEditYear = (y: AcademicYear) => {
        setEditingYear(y);
        yearForm.clearErrors();
        yearForm.setData({ name: y.name, start_date: y.start_date ?? '', end_date: y.end_date ?? '', generate_semesters: false });
        setYearDialog(true);
    };
    const submitYear = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { onSuccess: () => { setYearDialog(false); toast.success('تم الحفظ'); } };
        editingYear ? yearForm.put(`/academic-years/${editingYear.id}`, opts) : yearForm.post('/academic-years', opts);
    };

    /* ---- Semester ---- */
    const openCreateSem = (yearId: number) => {
        setEditingSem(null);
        setSemYearId(yearId);
        semForm.reset();
        semForm.clearErrors();
        semForm.setData('academic_year_id', yearId);
        setSemDialog(true);
    };
    const openEditSem = (s: Semester) => {
        setEditingSem(s);
        setSemYearId(s.academic_year_id);
        semForm.clearErrors();
        semForm.setData({ academic_year_id: s.academic_year_id, name: s.name, start_date: s.start_date ?? '', end_date: s.end_date ?? '' });
        setSemDialog(true);
    };
    const submitSem = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { onSuccess: () => { setSemDialog(false); toast.success('تم الحفظ'); } };
        editingSem ? semForm.put(`/semesters/${editingSem.id}`, opts) : semForm.post('/semesters', opts);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="الأعوام الدراسية" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="الأعوام الدراسية"
                    description="إدارة الأعوام والفصول الدراسية — كل العمليات مرتبطة بالعام والفصل الفعّال"
                    actions={canManage && <Button onClick={openCreateYear}><Plus className="size-4" /> عام جديد</Button>}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                    {years.map((y) => {
                        const badge = yearStatusBadge[y.status] ?? yearStatusBadge.active;
                        return (
                            <div key={y.id} className="bg-card space-y-4 rounded-2xl border border-border/60 p-5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold">{y.name}</h3>
                                            <Badge variant={badge.variant}>{badge.label}</Badge>
                                            {y.is_active && <Badge>فعّال</Badge>}
                                        </div>
                                        {y.start_date && (
                                            <p className="text-muted-foreground text-xs tnum">
                                                {formatDate(y.start_date)} → {formatDate(y.end_date)}
                                            </p>
                                        )}
                                    </div>
                                    {canManage && (
                                        <div className="flex flex-wrap justify-end gap-1">
                                            {!y.is_active && (
                                                <Button variant="outline" size="sm" onClick={() => action(`/academic-years/${y.id}/activate`, 'تم التفعيل')}>
                                                    <CheckCircle2 className="size-4" /> تفعيل
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => openEditYear(y)}><Pencil className="size-4" /></Button>
                                            {y.status === 'active' && (
                                                <Button variant="ghost" size="icon" title="إغلاق" onClick={() => action(`/academic-years/${y.id}/close`, 'تم الإغلاق')}>
                                                    <Lock className="size-4" />
                                                </Button>
                                            )}
                                            {y.status !== 'archived' && (
                                                <Button variant="ghost" size="icon" title="أرشفة" onClick={() => action(`/academic-years/${y.id}/archive`, 'تمت الأرشفة')}>
                                                    <Archive className="size-4" />
                                                </Button>
                                            )}
                                            {!y.is_active && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setConfirm({ url: `/academic-years/${y.id}`, title: 'حذف العام', desc: `سيتم حذف «${y.name}» وكل فصوله.`, destructive: true })}
                                                >
                                                    <Trash2 className="text-destructive size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* الفصول */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold">الفصول الدراسية</span>
                                        {canManage && (
                                            <Button variant="ghost" size="sm" onClick={() => openCreateSem(y.id)}>
                                                <Plus className="size-3.5" /> فصل
                                            </Button>
                                        )}
                                    </div>
                                    <div className="divide-y divide-border/60 rounded-xl border border-border/60">
                                        {y.semesters?.length ? (
                                            y.semesters.map((s) => (
                                                <div key={s.id} className="flex items-center justify-between gap-2 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">{s.name}</span>
                                                        {s.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">{semStatus[s.status]}</Badge>}
                                                    </div>
                                                    {canManage && (
                                                        <div className="flex gap-1">
                                                            {!s.is_active && (
                                                                <Button variant="outline" size="sm" onClick={() => action(`/semesters/${s.id}/activate`, 'تم التفعيل')}>
                                                                    تفعيل
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="icon" onClick={() => openEditSem(s)}><Pencil className="size-3.5" /></Button>
                                                            {s.status === 'active' && (
                                                                <Button variant="ghost" size="icon" title="إغلاق" onClick={() => action(`/semesters/${s.id}/close`, 'تم الإغلاق')}>
                                                                    <Lock className="size-3.5" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setConfirm({ url: `/semesters/${s.id}`, title: 'حذف الفصل', desc: `سيتم حذف «${s.name}».`, destructive: true })}
                                                            >
                                                                <Trash2 className="text-destructive size-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-muted-foreground p-3 text-sm">لا توجد فصول</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* نافذة العام */}
            <FormDialog open={yearDialog} onOpenChange={setYearDialog} title={editingYear ? 'تعديل عام' : 'عام دراسي جديد'} onSubmit={submitYear} loading={yearForm.processing}>
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="y_name">اسم العام</Label>
                        <Input id="y_name" placeholder="2027–2028" value={yearForm.data.name} onChange={(e) => yearForm.setData('name', e.target.value)} />
                        {yearForm.errors.name && <p className="text-destructive text-xs">{yearForm.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="y_start">تاريخ البداية</Label>
                        <Input id="y_start" type="date" value={yearForm.data.start_date} onChange={(e) => yearForm.setData('start_date', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="y_end">تاريخ النهاية</Label>
                        <Input id="y_end" type="date" value={yearForm.data.end_date} onChange={(e) => yearForm.setData('end_date', e.target.value)} />
                        {yearForm.errors.end_date && <p className="text-destructive text-xs">{yearForm.errors.end_date}</p>}
                    </div>
                </FormSection>
                {!editingYear && (
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={yearForm.data.generate_semesters} onChange={(e) => yearForm.setData('generate_semesters', e.target.checked)} />
                        إنشاء الفصلين الافتراضيين تلقائيًا
                    </label>
                )}
            </FormDialog>

            {/* نافذة الفصل */}
            <FormDialog open={semDialog} onOpenChange={setSemDialog} title={editingSem ? 'تعديل فصل' : 'فصل دراسي جديد'} onSubmit={submitSem} loading={semForm.processing}>
                <input type="hidden" value={semYearId ?? ''} readOnly />
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="s_name">اسم الفصل</Label>
                        <Input id="s_name" placeholder="الفصل الأول" value={semForm.data.name} onChange={(e) => semForm.setData('name', e.target.value)} />
                        {semForm.errors.name && <p className="text-destructive text-xs">{semForm.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="s_start">تاريخ البداية</Label>
                        <Input id="s_start" type="date" value={semForm.data.start_date} onChange={(e) => semForm.setData('start_date', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="s_end">تاريخ النهاية</Label>
                        <Input id="s_end" type="date" value={semForm.data.end_date} onChange={(e) => semForm.setData('end_date', e.target.value)} />
                    </div>
                </FormSection>
            </FormDialog>

            <ConfirmDialog
                open={!!confirm}
                onOpenChange={(o) => !o && setConfirm(null)}
                title={confirm?.title}
                description={confirm?.desc}
                destructive={confirm?.destructive}
                onConfirm={() => {
                    if (!confirm) return;
                    router.delete(confirm.url, { preserveScroll: true, onSuccess: () => { setConfirm(null); toast.success('تم الحذف'); } });
                }}
            />
        </AppLayout>
    );
}
