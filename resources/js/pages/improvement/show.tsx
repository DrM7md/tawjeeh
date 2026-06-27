import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { formatDate } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { CalendarClock, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { GoalsEditor } from './index';

const STATUS_LABELS: Record<string, string> = { active: 'نشطة', completed: 'مكتملة', cancelled: 'ملغاة' };

interface Review {
    id: number;
    review_date: string;
    progress_note: string | null;
    next_steps: string | null;
    creator?: { name: string } | null;
}
interface Plan {
    id: number;
    title: string | null;
    goals: string[] | null;
    status: 'active' | 'completed' | 'cancelled';
    start_date: string | null;
    target_date: string | null;
    target?: { name: string } | null;
    school?: { name: string } | null;
    department?: { name: string } | null;
    supervisor?: { name: string } | null;
    reviews?: Review[];
}
interface PageProps {
    plan: Plan;
    canEdit: boolean;
}

export default function ImprovementShow({ plan, canEdit }: Readonly<PageProps>) {
    const [deletingReview, setDeletingReview] = useState<Review | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'خطط التحسين', href: '/improvement' },
        { title: plan.target?.name ?? 'خطة', href: `/improvement/${plan.id}` },
    ];

    const planForm = useForm<{ title: string; goals: string[]; status: string; target_date: string }>({
        title: plan.title ?? '',
        goals: plan.goals?.length ? plan.goals : [''],
        status: plan.status,
        target_date: plan.target_date ?? '',
    });
    const savePlan = () => {
        planForm.put(`/improvement/${plan.id}`, { preserveScroll: true, onSuccess: () => toast.success('تم تحديث الخطة') });
    };

    const reviewForm = useForm<{ review_date: string; progress_note: string; next_steps: string }>({
        review_date: new Date().toISOString().slice(0, 10),
        progress_note: '',
        next_steps: '',
    });
    const addReview = (e: React.FormEvent) => {
        e.preventDefault();
        reviewForm.post(`/improvement/${plan.id}/reviews`, {
            preserveScroll: true,
            onSuccess: () => {
                reviewForm.reset();
                reviewForm.setData('review_date', new Date().toISOString().slice(0, 10));
                toast.success('تم تسجيل المراجعة');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`خطة تحسين — ${plan.target?.name ?? ''}`} />
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={plan.target?.name ?? 'خطة تحسين'}
                    description={`${plan.school?.name ?? ''} — ${plan.department?.name ?? ''}`}
                    backHref="/improvement"
                    actions={<Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>{STATUS_LABELS[plan.status]}</Badge>}
                />

                <div className="bg-card border-border/60 grid gap-3 rounded-2xl border p-5 sm:grid-cols-3">
                    <Info label="المستهدف" value={plan.target?.name} />
                    <Info label="المدرسة" value={plan.school?.name} />
                    <Info label="المادة" value={plan.department?.name} />
                    <Info label="الموجّه المسؤول" value={plan.supervisor?.name} />
                    <Info label="تاريخ البدء" value={formatDate(plan.start_date)} />
                    <Info label="تاريخ مستهدف" value={formatDate(plan.target_date)} />
                </div>

                {/* الخطة: العنوان + الأهداف + الحالة */}
                <section className="bg-card border-border/60 space-y-4 rounded-2xl border p-5">
                    <h2 className="font-semibold">تفاصيل الخطة</h2>
                    <div className="space-y-2">
                        <Label htmlFor="title">عنوان الخطة</Label>
                        <Input id="title" value={planForm.data.title} onChange={(e) => planForm.setData('title', e.target.value)} disabled={!canEdit} />
                    </div>
                    {canEdit ? (
                        <GoalsEditor value={planForm.data.goals} onChange={(g) => planForm.setData('goals', g)} />
                    ) : (
                        <div className="space-y-2">
                            <Label>الأهداف</Label>
                            <ul className="list-inside list-decimal space-y-1 text-sm">{plan.goals?.map((g, i) => <li key={i}>{g}</li>)}</ul>
                        </div>
                    )}
                    {canEdit && (
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-2">
                                <Label>الحالة</Label>
                                <Select value={planForm.data.status} onValueChange={(v) => planForm.setData('status', v)}>
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tdate">تاريخ مستهدف</Label>
                                <Input id="tdate" type="date" value={planForm.data.target_date} onChange={(e) => planForm.setData('target_date', e.target.value)} className="w-44" />
                            </div>
                            <Button onClick={savePlan} disabled={planForm.processing} className="ms-auto">
                                <Save className="size-4" /> حفظ التعديلات
                            </Button>
                        </div>
                    )}
                </section>

                {/* المراجعات الدورية (الشهرية للدعم المكثف) */}
                <section className="bg-card border-border/60 space-y-4 rounded-2xl border p-5">
                    <div className="flex items-center gap-2">
                        <CalendarClock className="text-primary size-5" />
                        <h2 className="font-semibold">المراجعات الدورية</h2>
                        <span className="text-muted-foreground tnum text-sm">({plan.reviews?.length ?? 0})</span>
                    </div>

                    {canEdit && (
                        <form onSubmit={addReview} className="bg-muted/30 space-y-3 rounded-xl border p-4">
                            <div className="space-y-2">
                                <Label htmlFor="rdate">تاريخ المراجعة</Label>
                                <Input id="rdate" type="date" value={reviewForm.data.review_date} onChange={(e) => reviewForm.setData('review_date', e.target.value)} className="w-44" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="progress">ملاحظة التقدّم</Label>
                                <textarea
                                    id="progress"
                                    rows={2}
                                    className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                                    value={reviewForm.data.progress_note}
                                    onChange={(e) => reviewForm.setData('progress_note', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="next">الخطوات التالية</Label>
                                <textarea
                                    id="next"
                                    rows={2}
                                    className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                                    value={reviewForm.data.next_steps}
                                    onChange={(e) => reviewForm.setData('next_steps', e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={reviewForm.processing}>
                                    تسجيل المراجعة
                                </Button>
                            </div>
                        </form>
                    )}

                    {plan.reviews?.length ? (
                        <ol className="border-border/60 space-y-4 border-s ps-4">
                            {plan.reviews.map((r) => (
                                <li key={r.id} className="relative">
                                    <span className="bg-primary absolute -start-[1.30rem] top-1.5 size-2.5 rounded-full" />
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold">{formatDate(r.review_date)}</p>
                                        <div className="flex items-center gap-2">
                                            {r.creator?.name && <span className="text-muted-foreground text-xs">{r.creator.name}</span>}
                                            {canEdit && (
                                                <button type="button" onClick={() => setDeletingReview(r)} aria-label="حذف المراجعة">
                                                    <Trash2 className="text-destructive size-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {r.progress_note && <p className="mt-1 text-sm whitespace-pre-line">{r.progress_note}</p>}
                                    {r.next_steps && (
                                        <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">
                                            <span className="font-medium">الخطوات التالية: </span>
                                            {r.next_steps}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-muted-foreground text-sm">لا توجد مراجعات بعد.</p>
                    )}
                </section>
            </div>

            <ConfirmDialog
                open={!!deletingReview}
                onOpenChange={(o) => !o && setDeletingReview(null)}
                title="حذف المراجعة"
                description="لا يمكن التراجع."
                onConfirm={() =>
                    deletingReview &&
                    router.delete(`/improvement-reviews/${deletingReview.id}`, {
                        preserveScroll: true,
                        onSuccess: () => {
                            setDeletingReview(null);
                            toast.success('تم الحذف');
                        },
                    })
                }
            />
        </AppLayout>
    );
}

function Info({ label, value }: Readonly<{ label: string; value?: string | null }>) {
    return (
        <div>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="text-sm font-medium">{value ?? '—'}</p>
        </div>
    );
}
