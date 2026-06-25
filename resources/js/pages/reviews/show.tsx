import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import { CheckCircle2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewForm {
    criteria: Record<string, number> | null;
    total_score: string | number | null;
    notes: string | null;
    result: string | null;
}
interface Review {
    id: number;
    grade: string | null;
    status: 'draft' | 'final';
    reviewed_at: string | null;
    school?: { name: string };
    department?: { name: string };
    stage?: { name: string };
    supervisor?: { name: string };
    form?: ReviewForm | null;
}
interface PageProps {
    review: Review;
    defaultCriteria: string[];
    canFinalize: boolean;
}

export default function ReviewShow({ review, defaultCriteria, canFinalize }: PageProps) {
    const isFinal = review.status === 'final';
    const readOnly = isFinal && !canFinalize;

    const initial: Record<string, number> = {};
    defaultCriteria.forEach((c) => (initial[c] = review.form?.criteria?.[c] ?? 0));

    const form = useForm<{ criteria: Record<string, number>; notes: string; result: string; status: string }>({
        criteria: initial,
        notes: review.form?.notes ?? '',
        result: review.form?.result ?? '',
        status: 'draft',
    });

    const total = Object.values(form.data.criteria).reduce((a, b) => a + (Number(b) || 0), 0);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'تحكيم الاختبارات', href: '/reviews' },
        { title: review.school?.name ?? 'تحكيم', href: `/reviews/${review.id}` },
    ];

    const save = (status: 'draft' | 'final') => {
        form.transform((data) => ({ ...data, status }));
        form.post(`/reviews/${review.id}/form`, { preserveScroll: true, onSuccess: () => toast.success(status === 'final' ? 'تم اعتماد التحكيم' : 'تم حفظ المسودة') });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`تحكيم — ${review.school?.name ?? ''}`} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
                <PageHeader title="سجل التحكيم" description={`${review.department?.name ?? ''} — ${review.grade ?? ''}`} actions={isFinal && <Badge>معتمد</Badge>} />

                <div className="bg-card grid gap-3 rounded-2xl border border-border/60 p-5 sm:grid-cols-2">
                    <Info label="المدرسة" value={review.school?.name} />
                    <Info label="المادة" value={review.department?.name} />
                    <Info label="المرحلة" value={review.stage?.name} />
                    <Info label="الصف" value={review.grade} />
                    <Info label="التاريخ" value={review.reviewed_at} />
                    <Info label="المحكّم" value={review.supervisor?.name} />
                </div>

                <section className="bg-card space-y-3 rounded-2xl border border-border/60 p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">معايير التحكيم</h2>
                        <span className="tnum text-sm">المجموع: <span className="text-primary font-bold">{total}</span></span>
                    </div>
                    {defaultCriteria.map((c) => (
                        <div key={c} className="flex items-center justify-between gap-3">
                            <span className="text-sm">{c}</span>
                            <Select value={String(form.data.criteria[c] ?? 0)} onValueChange={(v) => form.setData('criteria', { ...form.data.criteria, [c]: Number(v) })} disabled={readOnly}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">—</SelectItem>
                                    {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </section>

                <section className="bg-card space-y-4 rounded-2xl border border-border/60 p-5">
                    <div className="space-y-2">
                        <Label htmlFor="result">النتيجة / التقدير</Label>
                        <Input id="result" placeholder="ممتاز / جيد / يحتاج تحسين" value={form.data.result} onChange={(e) => form.setData('result', e.target.value)} disabled={readOnly} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes">الملاحظات</Label>
                        <textarea id="notes" rows={3} className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm" value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} disabled={readOnly} />
                    </div>
                </section>

                {!readOnly ? (
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
