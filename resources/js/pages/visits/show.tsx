import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Download, FileUp, Save, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

interface VisitFile {
    id: number;
    original_name: string;
    size: number;
}
interface VisitForm {
    id: number;
    axes: Record<string, number> | null;
    notes: string | null;
    recommendations: string | null;
    signature: string | null;
    save_status: 'draft' | 'final';
    files?: VisitFile[];
}
interface Visit {
    id: number;
    visit_type: string;
    visit_date: string;
    school?: { name: string };
    department?: { name: string };
    visitable?: { name: string };
    supervisor?: { name: string };
    form?: VisitForm | null;
}
interface PageProps {
    visit: Visit;
    defaultAxes: string[];
    canFinalize: boolean;
}

export default function VisitShow({ visit, defaultAxes, canFinalize }: PageProps) {
    const existing = visit.form;
    const isFinal = existing?.save_status === 'final';
    const readOnly = isFinal && !canFinalize;
    const fileInput = useRef<HTMLInputElement>(null);

    const initialAxes: Record<string, number> = {};
    defaultAxes.forEach((a) => (initialAxes[a] = existing?.axes?.[a] ?? 0));

    const form = useForm<{ axes: Record<string, number>; notes: string; recommendations: string; signature: string; save_status: string }>({
        axes: initialAxes,
        notes: existing?.notes ?? '',
        recommendations: existing?.recommendations ?? '',
        signature: existing?.signature ?? '',
        save_status: 'draft',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'الزيارات', href: '/visits' },
        { title: visit.visitable?.name ?? 'استمارة', href: `/visits/${visit.id}` },
    ];

    const save = (status: 'draft' | 'final') => {
        form.transform((data) => ({ ...data, save_status: status }));
        form.post(`/visits/${visit.id}/form`, {
            preserveScroll: true,
            onSuccess: () => toast.success(status === 'final' ? 'تم اعتماد الاستمارة' : 'تم حفظ المسودة'),
        });
    };

    const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        router.post(`/visits/${visit.id}/files`, { file }, { forceFormData: true, preserveScroll: true, onSuccess: () => toast.success('تم رفع المرفق') });
        if (fileInput.current) fileInput.current.value = '';
    };

    const deleteFile = (id: number) => router.delete(`/visit-files/${id}`, { preserveScroll: true, onSuccess: () => toast.success('تم حذف المرفق') });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`استمارة زيارة — ${visit.visitable?.name ?? ''}`} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="استمارة الزيارة"
                    description={`${visit.visit_type === 'teacher' ? 'معلم' : 'منسق'}: ${visit.visitable?.name ?? ''}`}
                    actions={isFinal && <Badge>معتمدة</Badge>}
                />

                {/* بيانات الزيارة */}
                <div className="bg-card grid gap-3 rounded-2xl border border-border/60 p-5 sm:grid-cols-2">
                    <Info label="المدرسة" value={visit.school?.name} />
                    <Info label="المادة" value={visit.department?.name} />
                    <Info label="التاريخ" value={visit.visit_date} />
                    <Info label="الموجه" value={visit.supervisor?.name} />
                </div>

                {/* محاور التقييم */}
                <section className="bg-card space-y-3 rounded-2xl border border-border/60 p-5">
                    <h2 className="font-semibold">محاور التقييم</h2>
                    {defaultAxes.map((axis) => (
                        <div key={axis} className="flex items-center justify-between gap-3">
                            <span className="text-sm">{axis}</span>
                            <Select
                                value={String(form.data.axes[axis] ?? 0)}
                                onValueChange={(v) => form.setData('axes', { ...form.data.axes, [axis]: Number(v) })}
                                disabled={readOnly}
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">—</SelectItem>
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </section>

                {/* الملاحظات والتوصيات */}
                <section className="bg-card space-y-4 rounded-2xl border border-border/60 p-5">
                    <div className="space-y-2">
                        <Label htmlFor="notes">الملاحظات</Label>
                        <textarea
                            id="notes"
                            rows={3}
                            className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                            value={form.data.notes}
                            onChange={(e) => form.setData('notes', e.target.value)}
                            disabled={readOnly}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rec">التوصيات</Label>
                        <textarea
                            id="rec"
                            rows={3}
                            className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                            value={form.data.recommendations}
                            onChange={(e) => form.setData('recommendations', e.target.value)}
                            disabled={readOnly}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="sig">التوقيع الإلكتروني (الاسم)</Label>
                        <Input id="sig" value={form.data.signature} onChange={(e) => form.setData('signature', e.target.value)} disabled={readOnly} />
                    </div>
                </section>

                {/* المرفقات */}
                <section className="bg-card space-y-3 rounded-2xl border border-border/60 p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">المرفقات</h2>
                        {!readOnly && (
                            <>
                                <input ref={fileInput} type="file" className="hidden" onChange={upload} />
                                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                                    <FileUp className="size-4" /> رفع مرفق
                                </Button>
                            </>
                        )}
                    </div>
                    <div className="divide-y divide-border/60 rounded-xl border border-border/60">
                        {existing?.files?.length ? (
                            existing.files.map((f) => (
                                <div key={f.id} className="flex items-center justify-between p-3 text-sm">
                                    <span>{f.original_name}</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" asChild>
                                            <a href={`/visit-files/${f.id}/download`}>
                                                <Download className="size-4" />
                                            </a>
                                        </Button>
                                        {!readOnly && (
                                            <Button variant="ghost" size="icon" onClick={() => deleteFile(f.id)}>
                                                <Trash2 className="text-destructive size-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground p-3 text-sm">لا مرفقات</p>
                        )}
                    </div>
                </section>

                {/* أزرار الحفظ */}
                {!readOnly && (
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => save('draft')} disabled={form.processing}>
                            <Save className="size-4" /> حفظ كمسودة
                        </Button>
                        {canFinalize && (
                            <Button onClick={() => save('final')} disabled={form.processing}>
                                <CheckCircle2 className="size-4" /> اعتماد نهائي
                            </Button>
                        )}
                    </div>
                )}
                {readOnly && <p className="text-muted-foreground text-center text-sm">الاستمارة معتمدة — للعرض فقط.</p>}
            </div>
        </AppLayout>
    );
}

function Info({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="text-sm font-medium">{value ?? '—'}</p>
        </div>
    );
}
