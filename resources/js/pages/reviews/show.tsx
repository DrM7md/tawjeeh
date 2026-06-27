import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import { examPeriodLabel } from '@/lib/exam-periods';
import { cn, formatDate } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Download, FileUp, Printer, Save, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

type ItemSelection = {
    indicator_id: number | null;
    notes: string;
};
interface ReviewForm {
    criteria: Record<string, ItemSelection> | null;
    notes: string | null;
}
interface ReviewFile {
    id: number;
    original_name: string;
    size: number;
    mime: string | null;
}
interface Review {
    id: number;
    status: 'draft' | 'final';
    exam_period: string | null;
    reviewed_at: string | null;
    school?: { name: string };
    department?: { name: string };
    stage?: { name: string };
    grade?: { name: string } | null;
    track?: { name: string } | null;
    preparer?: { name: string } | null;
    supervisor?: { name: string };
    form?: ReviewForm | null;
    files?: ReviewFile[];
}
interface Indicator {
    id: number;
    label: string;
    weight: number;
}
interface Item {
    id: number;
    name: string;
    description: string | null;
    indicators: Indicator[];
}
interface Domain {
    id: number;
    name: string;
    kind: string;
    items: Item[];
}
interface PageProps {
    review: Review;
    domains: Domain[];
    canFinalize: boolean;
    canEdit: boolean;
}

export default function ReviewShow({ review, domains, canFinalize, canEdit }: Readonly<PageProps>) {
    const isFinal = review.status === 'final';
    const readOnly = isFinal && !canFinalize;
    const fileInput = useRef<HTMLInputElement>(null);

    const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        router.post(
            `/reviews/${review.id}/files`,
            { file },
            { forceFormData: true, preserveScroll: true, onSuccess: () => toast.success('تم رفع الاستمارة') },
        );
        if (fileInput.current) fileInput.current.value = '';
    };
    const removeFile = (id: number) => {
        router.delete(`/review-files/${id}`, { preserveScroll: true, onSuccess: () => toast.success('تم حذف المرفق') });
    };

    // الحالة الأولية لكل بند: المؤشّر المختار + الملاحظات المحفوظة
    const initial: Record<string, ItemSelection> = {};
    domains.forEach((d) =>
        d.items.forEach((it) => {
            const saved = review.form?.criteria?.[it.id];
            initial[it.id] = { indicator_id: saved?.indicator_id ?? null, notes: saved?.notes ?? '' };
        }),
    );

    const form = useForm<{ criteria: Record<string, ItemSelection>; status: string }>({
        criteria: initial,
        status: 'draft',
    });

    const setItem = (itemId: number, patch: Partial<ItemSelection>) =>
        form.setData('criteria', { ...form.data.criteria, [itemId]: { ...form.data.criteria[itemId], ...patch } });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'تحكيم الاختبارات', href: '/reviews' },
        { title: review.school?.name ?? 'تحكيم', href: `/reviews/${review.id}` },
    ];

    const save = (status: 'draft' | 'final') => {
        form.transform((data) => ({ ...data, status }));
        form.post(`/reviews/${review.id}/form`, {
            preserveScroll: true,
            onSuccess: () => toast.success(status === 'final' ? 'تم اعتماد التحكيم' : 'تم حفظ المسودة'),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`تحكيم — ${review.school?.name ?? ''}`} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="استمارة تحكيم واعتماد الاختبار"
                    description={`${review.department?.name ?? ''} — ${review.grade?.name ?? ''}`}
                    backHref="/reviews"
                    actions={
                        <div className="flex items-center gap-2">
                            {isFinal && <Badge>معتمد</Badge>}
                            <Button variant="outline" size="sm" asChild>
                                <a href={`/reviews/${review.id}/print`} target="_blank" rel="noreferrer">
                                    <Printer className="size-4" /> طباعة
                                </a>
                            </Button>
                        </div>
                    }
                />

                <div className="bg-card border-border/60 grid gap-3 rounded-2xl border p-5 sm:grid-cols-2">
                    <Info label="المدرسة" value={review.school?.name} />
                    <Info label="الاختبار" value={examPeriodLabel(review.exam_period)} />
                    <Info label="المادة" value={review.department?.name} />
                    <Info label="المرحلة" value={review.stage?.name} />
                    <Info label="الصف" value={review.track?.name ? `${review.grade?.name} — ${review.track.name}` : review.grade?.name} />
                    <Info label="معد الاختبار" value={review.preparer?.name} />
                    <Info label="التاريخ" value={formatDate(review.reviewed_at)} />
                    <Info label="المحكّم" value={review.supervisor?.name} />
                </div>

                {/* المجالات ← البنود ← المؤشرات + ملاحظات وتوصيات */}
                {domains.map((domain) => (
                    <section key={domain.id} className="bg-card border-border/60 space-y-4 rounded-2xl border p-5">
                        <h2 className={cn('font-semibold', domain.kind === 'approval' && 'text-primary')}>{domain.name}</h2>
                        {domain.items.map((it) => {
                            const sel = form.data.criteria[it.id] ?? { indicator_id: null, notes: '' };
                            return (
                                <div key={it.id} className="border-border/60 space-y-2.5 border-t pt-4 first:border-t-0 first:pt-0">
                                    <div>
                                        <p className="font-medium">{it.name}</p>
                                        {it.description && <p className="text-muted-foreground mt-0.5 text-xs">{it.description}</p>}
                                    </div>
                                    <ToggleGroup
                                        type="single"
                                        size="sm"
                                        dir="rtl"
                                        value={sel.indicator_id ? String(sel.indicator_id) : ''}
                                        onValueChange={(v) => setItem(it.id, { indicator_id: v ? Number(v) : null })}
                                        disabled={readOnly}
                                        className="flex-wrap justify-start gap-1.5"
                                    >
                                        {it.indicators.map((ind) => (
                                            <ToggleGroupItem
                                                key={ind.id}
                                                value={String(ind.id)}
                                                className="border-border/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg border px-3"
                                            >
                                                {ind.label}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                    <textarea
                                        rows={2}
                                        className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-70"
                                        placeholder="ملاحظات وتوصيات"
                                        value={sel.notes}
                                        onChange={(e) => setItem(it.id, { notes: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>
                            );
                        })}
                    </section>
                ))}

                {/* استمارة التحكيم (مرفقات) */}
                <section className="bg-card border-border/60 space-y-3 rounded-2xl border p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">استمارة التحكيم (مرفق)</h2>
                        {canEdit && !readOnly && (
                            <>
                                <input ref={fileInput} type="file" className="hidden" onChange={upload} />
                                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                                    <FileUp className="size-4" /> إرفاق استمارة
                                </Button>
                            </>
                        )}
                    </div>
                    {review.files?.length ? (
                        <ul className="divide-border/60 border-border/60 divide-y rounded-xl border">
                            {review.files.map((f) => (
                                <li key={f.id} className="flex items-center justify-between gap-2 p-3">
                                    <span className="truncate text-sm">{f.original_name}</span>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <span className="text-muted-foreground tnum text-xs">{Math.round(f.size / 1024)} ك.ب</span>
                                        <Button variant="ghost" size="icon" asChild>
                                            <a href={`/review-files/${f.id}/download`}>
                                                <Download className="size-4" />
                                            </a>
                                        </Button>
                                        {canEdit && !readOnly && (
                                            <Button variant="ghost" size="icon" onClick={() => removeFile(f.id)}>
                                                <Trash2 className="text-destructive size-4" />
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-sm">لا توجد استمارة مرفقة بعد.</p>
                    )}
                </section>

                {!readOnly ? (
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" onClick={() => save('draft')} disabled={form.processing}>
                            <Save className="size-4" /> حفظ كمسودة
                        </Button>
                        {canFinalize && (
                            <Button onClick={() => save('final')} disabled={form.processing}>
                                <CheckCircle2 className="size-4" /> اعتماد نهائي
                            </Button>
                        )}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center text-sm">السجل معتمد — للعرض فقط.</p>
                )}
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
