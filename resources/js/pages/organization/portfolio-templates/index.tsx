import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog, FormSection } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PortfolioReviewItem, type PortfolioReviewTemplate } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { FolderCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'الإعدادات', href: '/settings' },
    { title: 'قوالب تقييم الملفات', href: '/portfolio-templates' },
];

interface PageProps {
    templates: PortfolioReviewTemplate[];
}

export default function PortfolioTemplatesIndex({ templates }: Readonly<PageProps>) {
    const [templateDialog, setTemplateDialog] = useState<{ mode: 'create' | 'edit'; data?: PortfolioReviewTemplate } | null>(null);
    const [itemDialog, setItemDialog] = useState<{ templateId: number; data?: PortfolioReviewItem } | null>(null);
    const [deletingTemplate, setDeletingTemplate] = useState<PortfolioReviewTemplate | null>(null);
    const [deletingItem, setDeletingItem] = useState<PortfolioReviewItem | null>(null);

    const templateForm = useForm<{ name: string; description: string; is_active: boolean }>({ name: '', description: '', is_active: true });
    const itemForm = useForm({ criterion_text: '', max_score: 5 });

    const remove = (url: string, onDone: () => void) =>
        router.delete(url, {
            preserveScroll: true,
            onSuccess: () => {
                onDone();
                toast.success('تم الحذف');
            },
        });

    const openTemplateCreate = () => {
        templateForm.clearErrors();
        templateForm.setData({ name: '', description: '', is_active: true });
        setTemplateDialog({ mode: 'create' });
    };
    const openTemplateEdit = (t: PortfolioReviewTemplate) => {
        templateForm.clearErrors();
        templateForm.setData({ name: t.name, description: t.description ?? '', is_active: t.is_active });
        setTemplateDialog({ mode: 'edit', data: t });
    };
    const submitTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        const onSuccess = () => {
            setTemplateDialog(null);
            toast.success('تم الحفظ');
        };
        if (templateDialog?.mode === 'edit' && templateDialog.data) {
            templateForm.put(`/portfolio-templates/${templateDialog.data.id}`, { onSuccess });
        } else {
            templateForm.post('/portfolio-templates', { onSuccess });
        }
    };

    const openItemCreate = (templateId: number) => {
        itemForm.clearErrors();
        itemForm.setData({ criterion_text: '', max_score: 5 });
        setItemDialog({ templateId });
    };
    const openItemEdit = (templateId: number, item: PortfolioReviewItem) => {
        itemForm.clearErrors();
        itemForm.setData({ criterion_text: item.criterion_text, max_score: item.max_score });
        setItemDialog({ templateId, data: item });
    };
    const submitItem = (e: React.FormEvent) => {
        e.preventDefault();
        const onSuccess = () => {
            setItemDialog(null);
            toast.success('تم الحفظ');
        };
        if (itemDialog?.data) {
            itemForm.put(`/portfolio-items/${itemDialog.data.id}`, { onSuccess });
        } else if (itemDialog) {
            itemForm.post(`/portfolio-templates/${itemDialog.templateId}/items`, { onSuccess });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="قوالب تقييم الملفات" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="قوالب تقييم ملفات المنسق"
                    description="أنشئ قوالب بنود مرنة (إضافة/تعديل/حذف بند، تغيير درجته، تفعيل/تعطيل القالب)"
                    backHref="/settings"
                    actions={
                        <Button onClick={openTemplateCreate}>
                            <Plus className="size-4" /> قالب جديد
                        </Button>
                    }
                />

                {templates.length === 0 && (
                    <div className="bg-card border-border/60 text-muted-foreground rounded-2xl border p-10 text-center text-sm">
                        لا توجد قوالب بعد — ابدأ بإنشاء قالب.
                    </div>
                )}

                {templates.map((t) => (
                    <section key={t.id} className="bg-card border-border/60 space-y-4 rounded-2xl border p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-xl">
                                    <FolderCheck className="text-primary size-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-semibold">{t.name}</h2>
                                        {!t.is_active && <Badge variant="secondary">معطّل</Badge>}
                                    </div>
                                    {t.description && <p className="text-muted-foreground text-sm">{t.description}</p>}
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        {t.items?.length ?? 0} بند · استُخدم في {t.reviews_count ?? 0} تقييم
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openTemplateEdit(t)} aria-label="تعديل القالب">
                                    <Pencil className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeletingTemplate(t)} aria-label="حذف القالب">
                                    <Trash2 className="text-destructive size-4" />
                                </Button>
                            </div>
                        </div>

                        <ul className="divide-border/60 border-border/60 divide-y rounded-xl border">
                            {(t.items ?? []).map((item) => (
                                <li key={item.id} className="flex items-center justify-between gap-2 p-3">
                                    <span className="text-sm">
                                        {item.criterion_text}
                                        <span className="text-muted-foreground tnum text-xs"> / {item.max_score}</span>
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => openItemEdit(t.id, item)} aria-label="تعديل البند">
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeletingItem(item)} aria-label="حذف البند">
                                            <Trash2 className="text-destructive size-3.5" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                            {(t.items?.length ?? 0) === 0 && <li className="text-muted-foreground p-3 text-sm">لا توجد بنود بعد.</li>}
                        </ul>

                        <Button variant="outline" size="sm" onClick={() => openItemCreate(t.id)}>
                            <Plus className="size-4" /> أضف بندًا
                        </Button>
                    </section>
                ))}
            </div>

            {/* نموذج القالب */}
            <FormDialog
                open={!!templateDialog}
                onOpenChange={(o) => !o && setTemplateDialog(null)}
                title={templateDialog?.mode === 'edit' ? 'تعديل القالب' : 'قالب جديد'}
                onSubmit={submitTemplate}
                loading={templateForm.processing}
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="tname">اسم القالب</Label>
                        <Input id="tname" value={templateForm.data.name} onChange={(e) => templateForm.setData('name', e.target.value)} />
                        {templateForm.errors.name && <p className="text-destructive text-xs">{templateForm.errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tdesc">الوصف (اختياري)</Label>
                        <Input id="tdesc" value={templateForm.data.description} onChange={(e) => templateForm.setData('description', e.target.value)} />
                    </div>
                    <label htmlFor="tactive" className="flex items-center justify-between">
                        <span className="text-sm font-medium">القالب مُفعّل</span>
                        <Checkbox
                            id="tactive"
                            checked={templateForm.data.is_active}
                            onCheckedChange={(v) => templateForm.setData('is_active', Boolean(v))}
                        />
                    </label>
                </FormSection>
            </FormDialog>

            {/* نموذج البند */}
            <FormDialog
                open={!!itemDialog}
                onOpenChange={(o) => !o && setItemDialog(null)}
                title={itemDialog?.data ? 'تعديل البند' : 'بند جديد'}
                onSubmit={submitItem}
                loading={itemForm.processing}
            >
                <FormSection>
                    <div className="space-y-2">
                        <Label htmlFor="itext">نص البند (المعيار)</Label>
                        <Input id="itext" value={itemForm.data.criterion_text} onChange={(e) => itemForm.setData('criterion_text', e.target.value)} />
                        {itemForm.errors.criterion_text && <p className="text-destructive text-xs">{itemForm.errors.criterion_text}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="imax">الدرجة العظمى</Label>
                        <Input
                            id="imax"
                            type="number"
                            min={1}
                            max={100}
                            value={itemForm.data.max_score}
                            onChange={(e) => itemForm.setData('max_score', Number(e.target.value))}
                        />
                        {itemForm.errors.max_score && <p className="text-destructive text-xs">{itemForm.errors.max_score}</p>}
                    </div>
                </FormSection>
            </FormDialog>

            <ConfirmDialog
                open={!!deletingTemplate}
                onOpenChange={(o) => !o && setDeletingTemplate(null)}
                title="حذف القالب"
                description="سيتم حذف القالب وكل بنوده. لا يمكن حذف قالب استُخدم في تقييمات."
                onConfirm={() => deletingTemplate && remove(`/portfolio-templates/${deletingTemplate.id}`, () => setDeletingTemplate(null))}
            />
            <ConfirmDialog
                open={!!deletingItem}
                onOpenChange={(o) => !o && setDeletingItem(null)}
                title="حذف البند"
                description="سيتم حذف هذا البند من القالب."
                onConfirm={() => deletingItem && remove(`/portfolio-items/${deletingItem.id}`, () => setDeletingItem(null))}
            />
        </AppLayout>
    );
}
