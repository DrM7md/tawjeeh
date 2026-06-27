import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { BookOpen, ChevronDown, Link2, MessageSquarePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Recommendation {
    id: number;
    text: string;
}
interface Standard {
    id: number;
    name: string;
    recommendations: Recommendation[];
}
interface Domain {
    id: number;
    name: string;
    standards: Standard[];
}
interface Template {
    id: number;
    name: string;
    description: string | null;
    domains: Domain[];
    departments: { id: number; name: string }[];
}
interface PageProps {
    template: Template;
    availableDepartments: { id: number; name: string }[];
}

type DeleteTarget = { type: 'domain' | 'standard'; id: number; name: string } | null;

export default function SupervisionTemplateShow({ template, availableDepartments }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'الإعدادات', href: '/settings' },
        { title: 'قوالب الإشراف', href: '/supervision-templates' },
        { title: template.name, href: `/supervision-templates/${template.id}` },
    ];

    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
    const toggle = (id: number) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // Link department
    const [linkDept, setLinkDept] = useState('');
    const linkDepartment = () => {
        if (!linkDept) return;
        router.post(`/supervision-templates/${template.id}/link-department`, { department_id: linkDept }, {
            preserveScroll: true,
            onSuccess: () => {
                setLinkDept('');
                toast.success('تم ربط القسم');
            },
        });
    };
    const unlinkDepartment = (id: number) =>
        router.delete(`/supervision-templates/${template.id}/departments/${id}`, { preserveScroll: true, onSuccess: () => toast.success('تم فك الربط') });

    // Domain modal
    const [domainModal, setDomainModal] = useState(false);
    const [editDomain, setEditDomain] = useState<Domain | null>(null);
    const [domainName, setDomainName] = useState('');
    const openCreateDomain = () => {
        setEditDomain(null);
        setDomainName('');
        setDomainModal(true);
    };
    const openEditDomain = (d: Domain) => {
        setEditDomain(d);
        setDomainName(d.name);
        setDomainModal(true);
    };
    const saveDomain = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: () => setDomainModal(false) };
        if (editDomain) router.put(`/supervision-domains/${editDomain.id}`, { name: domainName }, opts);
        else router.post(`/supervision-templates/${template.id}/domains`, { name: domainName }, opts);
    };

    // Standard modal
    const [standardModal, setStandardModal] = useState(false);
    const [editStandard, setEditStandard] = useState<Standard | null>(null);
    const [standardDomainId, setStandardDomainId] = useState<number | null>(null);
    const [standardName, setStandardName] = useState('');
    const openCreateStandard = (domainId: number) => {
        setEditStandard(null);
        setStandardDomainId(domainId);
        setStandardName('');
        setStandardModal(true);
    };
    const openEditStandard = (s: Standard) => {
        setEditStandard(s);
        setStandardName(s.name);
        setStandardModal(true);
    };
    const saveStandard = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: () => setStandardModal(false) };
        if (editStandard) router.put(`/supervision-standards/${editStandard.id}`, { name: standardName }, opts);
        else router.post(`/supervision-domains/${standardDomainId}/standards`, { name: standardName }, opts);
    };

    // Recommendation modal
    const [recModal, setRecModal] = useState(false);
    const [recStandardId, setRecStandardId] = useState<number | null>(null);
    const [recText, setRecText] = useState('');
    const openRec = (standardId: number) => {
        setRecStandardId(standardId);
        setRecText('');
        setRecModal(true);
    };
    const saveRec = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(`/supervision-standards/${recStandardId}/recommendations`, { text: recText }, { preserveScroll: true, onSuccess: () => setRecModal(false) });
    };
    const deleteRec = (id: number) => router.delete(`/supervision-recommendations/${id}`, { preserveScroll: true });

    // Delete domain/standard
    const [del, setDel] = useState<DeleteTarget>(null);
    const confirmDelete = () => {
        if (!del) return;
        const url = del.type === 'domain' ? `/supervision-domains/${del.id}` : `/supervision-standards/${del.id}`;
        router.delete(url, { preserveScroll: true, onSuccess: () => setDel(null) });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={template.name} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title={template.name} description={template.description ?? 'مجالات ومعايير القالب'} backHref="/supervision-templates" />

                {/* ربط الأقسام */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Link2 className="size-4" /> الأقسام المرتبطة بهذا القالب
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {template.departments.length === 0 && <span className="text-muted-foreground text-sm">لم يتم ربط أي قسم بعد</span>}
                            {template.departments.map((d) => (
                                <Badge key={d.id} variant="secondary" className="gap-1.5">
                                    {d.name}
                                    <button onClick={() => unlinkDepartment(d.id)} className="hover:text-destructive" aria-label="فك الربط">
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        {availableDepartments.length > 0 && (
                            <div className="flex items-end gap-2">
                                <div className="w-full max-w-xs">
                                    <Combobox
                                        items={availableDepartments.map((d) => ({ value: String(d.id), label: d.name }))}
                                        value={linkDept}
                                        onChange={setLinkDept}
                                        placeholder="اختر قسمًا لربطه..."
                                        emptyText="لا أقسام"
                                    />
                                </div>
                                <Button size="sm" onClick={linkDepartment} disabled={!linkDept}>
                                    <Plus className="size-4" /> ربط
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* المجالات والمعايير */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-semibold">
                            <BookOpen className="size-5" /> المجالات والمعايير
                        </h2>
                        <Button size="sm" onClick={openCreateDomain}>
                            <Plus className="size-4" /> إضافة مجال
                        </Button>
                    </div>

                    {template.domains.length === 0 ? (
                        <Card>
                            <CardContent className="text-muted-foreground py-8 text-center text-sm">لا توجد مجالات. ابدأ بإضافة مجال.</CardContent>
                        </Card>
                    ) : (
                        template.domains.map((domain, dIdx) => {
                            const isOpen = !collapsed.has(domain.id);
                            return (
                                <Card key={domain.id} className="overflow-hidden p-0">
                                    <button
                                        type="button"
                                        onClick={() => toggle(domain.id)}
                                        className="flex w-full items-center justify-between gap-2 bg-muted/30 px-4 py-3 hover:bg-accent"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-bold">{dIdx + 1}</span>
                                            <span className="font-bold">{domain.name}</span>
                                            <Badge variant="secondary">{domain.standards.length} معيار</Badge>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => { e.stopPropagation(); openEditDomain(domain); }}
                                                className="text-muted-foreground hover:text-primary rounded p-1.5"
                                            >
                                                <Pencil className="size-4" />
                                            </span>
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => { e.stopPropagation(); setDel({ type: 'domain', id: domain.id, name: domain.name }); }}
                                                className="text-muted-foreground hover:text-destructive rounded p-1.5"
                                            >
                                                <Trash2 className="size-4" />
                                            </span>
                                            <ChevronDown className={`text-muted-foreground size-5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <div className="space-y-2 p-4">
                                            {domain.standards.length === 0 ? (
                                                <p className="text-muted-foreground py-4 text-center text-sm">لا توجد معايير في هذا المجال</p>
                                            ) : (
                                                domain.standards.map((std, sIdx) => (
                                                    <div key={std.id} className="rounded-xl border border-border/60 p-3 hover:bg-accent/40">
                                                        <div className="flex items-start gap-3">
                                                            <span className="text-muted-foreground mt-0.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium tnum">
                                                                {dIdx + 1}.{sIdx + 1}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm">{std.name}</p>
                                                                {std.recommendations.length > 0 && (
                                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                                        {std.recommendations.map((rec) => (
                                                                            <span key={rec.id} className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                                                                {rec.text}
                                                                                <button onClick={() => deleteRec(rec.id)} className="hover:text-destructive" aria-label="حذف التوصية">
                                                                                    <X className="size-3" />
                                                                                </button>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex shrink-0 items-center gap-1">
                                                                <Button variant="ghost" size="icon" onClick={() => openRec(std.id)} title="إضافة توصية جاهزة" aria-label="توصية">
                                                                    <MessageSquarePlus className="size-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => openEditStandard(std)} aria-label="تعديل">
                                                                    <Pencil className="size-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => setDel({ type: 'standard', id: std.id, name: std.name })} aria-label="حذف">
                                                                    <Trash2 className="text-destructive size-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => openCreateStandard(domain.id)}>
                                                <Plus className="size-4" /> إضافة معيار
                                            </Button>
                                        </div>
                                    )}
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>

            {/* نوافذ */}
            <FormDialog open={domainModal} onOpenChange={setDomainModal} title={editDomain ? 'تعديل المجال' : 'إضافة مجال'} onSubmit={saveDomain} submitLabel={editDomain ? 'تحديث' : 'إضافة'}>
                <div className="space-y-2">
                    <Label htmlFor="dname">اسم المجال</Label>
                    <Input id="dname" value={domainName} onChange={(e) => setDomainName(e.target.value)} placeholder="مثال: التخطيط للدرس" autoFocus required />
                </div>
            </FormDialog>

            <FormDialog open={standardModal} onOpenChange={setStandardModal} title={editStandard ? 'تعديل المعيار' : 'إضافة معيار'} onSubmit={saveStandard} submitLabel={editStandard ? 'تحديث' : 'إضافة'}>
                <div className="space-y-2">
                    <Label htmlFor="sname">نص المعيار</Label>
                    <textarea
                        id="sname"
                        rows={3}
                        className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                        value={standardName}
                        onChange={(e) => setStandardName(e.target.value)}
                        placeholder="اكتب نص المعيار هنا..."
                        autoFocus
                    />
                </div>
            </FormDialog>

            <FormDialog open={recModal} onOpenChange={setRecModal} title="إضافة توصية جاهزة" onSubmit={saveRec} submitLabel="إضافة">
                <div className="space-y-2">
                    <Label htmlFor="rtext">نص التوصية</Label>
                    <textarea
                        id="rtext"
                        rows={3}
                        className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                        value={recText}
                        onChange={(e) => setRecText(e.target.value)}
                        placeholder="اكتب نص التوصية الجاهزة..."
                        autoFocus
                    />
                </div>
            </FormDialog>

            <ConfirmDialog
                open={!!del}
                onOpenChange={(o) => !o && setDel(null)}
                title="تأكيد الحذف"
                description={`حذف ${del?.type === 'domain' ? 'المجال' : 'المعيار'}: «${del?.name ?? ''}»${del?.type === 'domain' ? ' وكل معاييره وتوصياته.' : '.'}`}
                confirmLabel="حذف"
                onConfirm={confirmDelete}
            />
        </AppLayout>
    );
}
