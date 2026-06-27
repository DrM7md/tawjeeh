import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'إعدادات الهيكل', href: '/organization-settings' },
    { title: 'استمارة التحكيم', href: '/review-form' },
];

type DeleteTarget = { type: 'domain' | 'item' | 'indicator'; id: number; name: string } | null;

export default function ReviewFormEditor({ domains }: Readonly<{ domains: Domain[] }>) {
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
    const toggle = (id: number) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // ---- مودال المجال ----
    const [domainModal, setDomainModal] = useState(false);
    const [editDomain, setEditDomain] = useState<Domain | null>(null);
    const [domainName, setDomainName] = useState('');
    const [domainKind, setDomainKind] = useState('rating');
    const openCreateDomain = () => {
        setEditDomain(null);
        setDomainName('');
        setDomainKind('rating');
        setDomainModal(true);
    };
    const openEditDomain = (d: Domain) => {
        setEditDomain(d);
        setDomainName(d.name);
        setDomainKind(d.kind);
        setDomainModal(true);
    };
    const saveDomain = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { name: domainName, kind: domainKind };
        const opts = { preserveScroll: true, onSuccess: () => setDomainModal(false) };
        if (editDomain) router.put(`/review-domains/${editDomain.id}`, payload, opts);
        else router.post('/review-domains', payload, opts);
    };

    // ---- مودال البند ----
    const [itemModal, setItemModal] = useState(false);
    const [editItem, setEditItem] = useState<Item | null>(null);
    const [itemDomainId, setItemDomainId] = useState<number | null>(null);
    const [itemName, setItemName] = useState('');
    const [itemDesc, setItemDesc] = useState('');
    const openCreateItem = (domainId: number) => {
        setEditItem(null);
        setItemDomainId(domainId);
        setItemName('');
        setItemDesc('');
        setItemModal(true);
    };
    const openEditItem = (it: Item) => {
        setEditItem(it);
        setItemName(it.name);
        setItemDesc(it.description ?? '');
        setItemModal(true);
    };
    const saveItem = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { name: itemName, description: itemDesc };
        const opts = { preserveScroll: true, onSuccess: () => setItemModal(false) };
        if (editItem) router.put(`/review-items/${editItem.id}`, payload, opts);
        else router.post(`/review-domains/${itemDomainId}/items`, payload, opts);
    };

    // ---- مودال المؤشّر ----
    const [indModal, setIndModal] = useState(false);
    const [editInd, setEditInd] = useState<Indicator | null>(null);
    const [indItemId, setIndItemId] = useState<number | null>(null);
    const [indLabel, setIndLabel] = useState('');
    const [indWeight, setIndWeight] = useState(0);
    const openCreateInd = (itemId: number) => {
        setEditInd(null);
        setIndItemId(itemId);
        setIndLabel('');
        setIndWeight(0);
        setIndModal(true);
    };
    const openEditInd = (ind: Indicator) => {
        setEditInd(ind);
        setIndLabel(ind.label);
        setIndWeight(ind.weight);
        setIndModal(true);
    };
    const saveInd = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { label: indLabel, weight: indWeight };
        const opts = { preserveScroll: true, onSuccess: () => setIndModal(false) };
        if (editInd) router.put(`/review-indicators/${editInd.id}`, payload, opts);
        else router.post(`/review-items/${indItemId}/indicators`, payload, opts);
    };

    // ---- حذف ----
    const [del, setDel] = useState<DeleteTarget>(null);
    const confirmDelete = () => {
        if (!del) return;
        const url = { domain: '/review-domains', item: '/review-items', indicator: '/review-indicators' }[del.type];
        router.delete(`${url}/${del.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setDel(null);
                toast.success('تم الحذف');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="استمارة التحكيم" />
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="استمارة تحكيم الاختبارات"
                    description="المجالات والبنود والمؤشرات — كما تظهر في استمارة المحكّم"
                    backHref="/organization-settings"
                    actions={
                        <Button onClick={openCreateDomain}>
                            <Plus className="size-4" /> إضافة مجال
                        </Button>
                    }
                />

                {domains.length === 0 ? (
                    <Card>
                        <CardContent className="text-muted-foreground py-10 text-center text-sm">لا توجد مجالات بعد. ابدأ بإضافة مجال.</CardContent>
                    </Card>
                ) : (
                    domains.map((domain, dIdx) => {
                        const isOpen = !collapsed.has(domain.id);
                        return (
                            <Card key={domain.id} className="overflow-hidden p-0">
                                <button
                                    type="button"
                                    onClick={() => toggle(domain.id)}
                                    className="bg-muted/30 hover:bg-accent flex w-full items-center justify-between gap-2 px-4 py-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full text-sm font-bold">
                                            {dIdx + 1}
                                        </span>
                                        <span className="font-bold">{domain.name}</span>
                                        {domain.kind === 'approval' && <Badge variant="secondary">اعتماد</Badge>}
                                        <Badge variant="secondary">{domain.items.length} بند</Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditDomain(domain);
                                            }}
                                            className="text-muted-foreground hover:text-primary rounded p-1.5"
                                        >
                                            <Pencil className="size-4" />
                                        </span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDel({ type: 'domain', id: domain.id, name: domain.name });
                                            }}
                                            className="text-muted-foreground hover:text-destructive rounded p-1.5"
                                        >
                                            <Trash2 className="size-4" />
                                        </span>
                                        <ChevronDown className={`text-muted-foreground size-5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="space-y-2 p-4">
                                        {domain.items.length === 0 ? (
                                            <p className="text-muted-foreground py-4 text-center text-sm">لا توجد بنود في هذا المجال</p>
                                        ) : (
                                            domain.items.map((it, sIdx) => (
                                                <div key={it.id} className="border-border/60 hover:bg-accent/40 rounded-xl border p-3">
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-muted-foreground tnum bg-muted mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium">
                                                            {dIdx + 1}.{sIdx + 1}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium">{it.name}</p>
                                                            {it.description && (
                                                                <p className="text-muted-foreground mt-0.5 text-xs">{it.description}</p>
                                                            )}
                                                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                                {it.indicators.map((ind) => (
                                                                    <span
                                                                        key={ind.id}
                                                                        className="bg-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                                                                    >
                                                                        {ind.label}
                                                                        <span className="text-muted-foreground tnum">({ind.weight})</span>
                                                                        <button
                                                                            onClick={() => openEditInd(ind)}
                                                                            className="hover:text-primary"
                                                                            aria-label="تعديل المؤشّر"
                                                                        >
                                                                            <Pencil className="size-3" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDel({ type: 'indicator', id: ind.id, name: ind.label })}
                                                                            className="hover:text-destructive"
                                                                            aria-label="حذف المؤشّر"
                                                                        >
                                                                            <X className="size-3" />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2"
                                                                    onClick={() => openCreateInd(it.id)}
                                                                >
                                                                    <Plus className="size-3.5" /> مؤشّر
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => openEditItem(it)}
                                                                aria-label="تعديل البند"
                                                            >
                                                                <Pencil className="size-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setDel({ type: 'item', id: it.id, name: it.name })}
                                                                aria-label="حذف البند"
                                                            >
                                                                <Trash2 className="text-destructive size-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-dashed"
                                            onClick={() => openCreateItem(domain.id)}
                                        >
                                            <Plus className="size-4" /> إضافة بند
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        );
                    })
                )}
            </div>

            {/* نوافذ */}
            <FormDialog
                open={domainModal}
                onOpenChange={setDomainModal}
                title={editDomain ? 'تعديل المجال' : 'إضافة مجال'}
                onSubmit={saveDomain}
                submitLabel={editDomain ? 'تحديث' : 'إضافة'}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="dname">اسم المجال</Label>
                        <Input
                            id="dname"
                            value={domainName}
                            onChange={(e) => setDomainName(e.target.value)}
                            placeholder="مثال: الأسئلة"
                            autoFocus
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>النوع</Label>
                        <Select value={domainKind} onValueChange={setDomainKind}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="rating">تقييم</SelectItem>
                                <SelectItem value="approval">اعتماد</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </FormDialog>

            <FormDialog
                open={itemModal}
                onOpenChange={setItemModal}
                title={editItem ? 'تعديل البند' : 'إضافة بند'}
                onSubmit={saveItem}
                submitLabel={editItem ? 'تحديث' : 'إضافة'}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="iname">اسم البند</Label>
                        <Input
                            id="iname"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            placeholder="مثال: جودة الأسئلة ودقة صياغتها"
                            autoFocus
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="idesc">وصف فرعي (اختياري)</Label>
                        <Input
                            id="idesc"
                            value={itemDesc}
                            onChange={(e) => setItemDesc(e.target.value)}
                            placeholder="مثال: الغلاف – التعليمات – الصور والأشكال"
                        />
                    </div>
                </div>
            </FormDialog>

            <FormDialog
                open={indModal}
                onOpenChange={setIndModal}
                title={editInd ? 'تعديل المؤشّر' : 'إضافة مؤشّر'}
                onSubmit={saveInd}
                submitLabel={editInd ? 'تحديث' : 'إضافة'}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ilabel">نص المؤشّر</Label>
                        <Input
                            id="ilabel"
                            value={indLabel}
                            onChange={(e) => setIndLabel(e.target.value)}
                            placeholder="مثال: دقيقة"
                            autoFocus
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="iweight">الوزن (درجة خفية للإحصاء)</Label>
                        <Input
                            id="iweight"
                            type="number"
                            min={0}
                            max={100}
                            value={indWeight}
                            onChange={(e) => setIndWeight(Number(e.target.value))}
                        />
                    </div>
                </div>
            </FormDialog>

            <ConfirmDialog
                open={!!del}
                onOpenChange={(o) => !o && setDel(null)}
                title="تأكيد الحذف"
                description={`حذف ${del?.type === 'domain' ? 'المجال' : del?.type === 'item' ? 'البند' : 'المؤشّر'}: «${del?.name ?? ''}»${del?.type !== 'indicator' ? ' وكل ما بداخله.' : '.'}`}
                confirmLabel="حذف"
                onConfirm={confirmDelete}
            />
        </AppLayout>
    );
}
