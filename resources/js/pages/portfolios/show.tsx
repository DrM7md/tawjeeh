import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import { formatDate } from '@/lib/utils';
import { type BreadcrumbItem, type PortfolioReview } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Download, FileUp, Printer, Save, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

interface PageProps {
    review: PortfolioReview;
    canFinalize: boolean;
    canEdit: boolean;
}

export default function PortfolioShow({ review, canFinalize, canEdit }: Readonly<PageProps>) {
    const isFinal = review.status === 'final';
    const readOnly = isFinal && !canFinalize;
    const scores = review.scores ?? [];
    const uploadRefs = useRef<Record<number, HTMLInputElement | null>>({});

    type Entry = { score: number | ''; note: string };
    const initial: Record<number, Entry> = {};
    scores.forEach((s) => (initial[s.id] = { score: s.score ?? '', note: s.note ?? '' }));

    const form = useForm<{ scores: Record<number, Entry>; notes: string; status: string }>({
        scores: initial,
        notes: review.notes ?? '',
        status: 'draft',
    });

    const setScore = (id: number, score: number | '') =>
        form.setData('scores', { ...form.data.scores, [id]: { ...form.data.scores[id], score } });
    const setNote = (id: number, note: string) =>
        form.setData('scores', { ...form.data.scores, [id]: { ...form.data.scores[id], note } });

    const total = Object.values(form.data.scores).reduce((a, e) => a + (Number(e.score) || 0), 0);
    const maxTotal = scores.reduce((a, s) => a + s.max_score, 0);

    const save = (status: 'draft' | 'final') => {
        form.transform((data) => ({ ...data, status }));
        form.post(`/portfolios/${review.id}/form`, {
            preserveScroll: true,
            onSuccess: () => toast.success(status === 'final' ? 'تم اعتماد التقييم' : 'تم حفظ المسودة'),
        });
    };

    const upload = (scoreId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        router.post(
            `/portfolio-scores/${scoreId}/attachment`,
            { file },
            { forceFormData: true, preserveScroll: true, onSuccess: () => toast.success('تم رفع المرفق') },
        );
        const input = uploadRefs.current[scoreId];
        if (input) input.value = '';
    };
    const removeAttachment = (scoreId: number) => {
        router.delete(`/portfolio-scores/${scoreId}/attachment`, { preserveScroll: true, onSuccess: () => toast.success('تم حذف المرفق') });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'تقييم ملفات المنسق', href: '/portfolios' },
        { title: review.coordinator?.name ?? 'تقييم', href: `/portfolios/${review.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`تقييم — ${review.coordinator?.name ?? ''}`} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="سجل تقييم الملفات"
                    description={`${review.coordinator?.name ?? ''} — ${review.template?.name ?? ''}`}
                    backHref="/portfolios"
                    actions={
                        <div className="flex items-center gap-2">
                            {isFinal && <Badge>معتمد</Badge>}
                            <Button variant="outline" size="sm" asChild>
                                <a href={`/portfolios/${review.id}/print`} target="_blank" rel="noopener">
                                    <Printer className="size-4" /> طباعة
                                </a>
                            </Button>
                        </div>
                    }
                />

                <div className="bg-card border-border/60 grid gap-3 rounded-2xl border p-5 sm:grid-cols-2">
                    <Info label="المنسق" value={review.coordinator?.name} />
                    <Info label="المدرسة" value={review.coordinator?.school?.name} />
                    <Info label="المادة" value={review.department?.name} />
                    <Info label="الفصل" value={review.term === 'second' ? 'الفصل الثاني' : 'الفصل الأول'} />
                    <Info label="القالب" value={review.template?.name} />
                    <Info label="التاريخ" value={formatDate(review.reviewed_at)} />
                    <Info label="المقيِّم" value={review.supervisor?.name} />
                </div>

                <section className="bg-card border-border/60 space-y-4 rounded-2xl border p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">بنود التقييم</h2>
                        <span className="tnum text-sm">
                            المجموع: <span className="text-primary font-bold">{total}</span>
                            <span className="text-muted-foreground"> / {maxTotal}</span>
                        </span>
                    </div>

                    {scores.length === 0 && <p className="text-muted-foreground text-sm">لا توجد بنود في هذا القالب.</p>}

                    {scores.map((s) => (
                        <div key={s.id} className="border-border/60 space-y-3 rounded-xl border p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <span className="text-sm font-medium">
                                        {s.criterion_text}
                                        <span className="text-muted-foreground tnum text-xs"> / {s.max_score}</span>
                                    </span>
                                    {s.indicators && <p className="text-muted-foreground mt-1 text-xs leading-6">{s.indicators}</p>}
                                </div>
                                {s.max_score <= 10 ? (
                                    <ToggleGroup
                                        type="single"
                                        size="sm"
                                        dir="rtl"
                                        value={String(form.data.scores[s.id]?.score ?? '')}
                                        onValueChange={(v) => setScore(s.id, v === '' ? '' : Number(v))}
                                        disabled={readOnly}
                                        className="flex-wrap justify-start gap-1"
                                    >
                                        {Array.from({ length: s.max_score + 1 }, (_, i) => i).map((n) => (
                                            <ToggleGroupItem
                                                key={n}
                                                value={String(n)}
                                                className="border-border/60 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground tnum min-w-9 rounded-lg border"
                                            >
                                                {n}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                ) : (
                                    <Input
                                        type="number"
                                        min={0}
                                        max={s.max_score}
                                        value={form.data.scores[s.id]?.score ?? ''}
                                        onChange={(e) => setScore(s.id, e.target.value === '' ? '' : Number(e.target.value))}
                                        disabled={readOnly}
                                        className="tnum w-24"
                                    />
                                )}
                            </div>

                            <Input
                                placeholder="الملاحظات والتوصيات"
                                value={form.data.scores[s.id]?.note ?? ''}
                                onChange={(e) => setNote(s.id, e.target.value)}
                                disabled={readOnly}
                            />

                            {/* مرفق البند (دليل/شاهد) */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                {s.attachment_path ? (
                                    <div className="flex min-w-0 items-center gap-1">
                                        <a href={`/portfolio-scores/${s.id}/download`} className="truncate text-sm hover:underline">
                                            {s.attachment_name}
                                        </a>
                                        <Button variant="ghost" size="icon" asChild>
                                            <a href={`/portfolio-scores/${s.id}/download`} aria-label="تنزيل">
                                                <Download className="size-4" />
                                            </a>
                                        </Button>
                                        {canEdit && !readOnly && (
                                            <Button variant="ghost" size="icon" onClick={() => removeAttachment(s.id)} aria-label="حذف المرفق">
                                                <Trash2 className="text-destructive size-4" />
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-xs">لا يوجد مرفق</span>
                                )}
                                {canEdit && !readOnly && (
                                    <>
                                        <input
                                            ref={(el) => {
                                                uploadRefs.current[s.id] = el;
                                            }}
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => upload(s.id, e)}
                                        />
                                        <Button variant="outline" size="sm" onClick={() => uploadRefs.current[s.id]?.click()}>
                                            <FileUp className="size-4" /> {s.attachment_path ? 'استبدال المرفق' : 'إرفاق دليل'}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </section>

                <section className="bg-card border-border/60 space-y-2 rounded-2xl border p-5">
                    <Label htmlFor="notes">ملاحظات عامة</Label>
                    <textarea
                        id="notes"
                        rows={3}
                        className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        disabled={readOnly}
                    />
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

function Info({ label, value }: { readonly label: string; readonly value?: string | null }) {
    return (
        <div>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="text-sm font-medium">{value ?? '—'}</p>
        </div>
    );
}
