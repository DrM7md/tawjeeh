import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormDialog } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { BookOpen, ChevronLeft, FileText, Link2, ListChecks, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Template {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    domains_count: number;
    standards_count: number;
    visits_count: number;
    departments: { id: number; name: string }[];
}
interface PageProps {
    templates: Template[];
    notePresets: { id: number; text: string }[];
    followUpTypes: { id: number; name: string }[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الإعدادات', href: '/settings' },
    { title: 'قوالب الإشراف', href: '/supervision-templates' },
];

export default function SupervisionTemplatesIndex({ templates, notePresets, followUpTypes }: PageProps) {
    const [open, setOpen] = useState(false);
    const [edit, setEdit] = useState<Template | null>(null);
    const [del, setDel] = useState<Template | null>(null);
    const [form, setForm] = useState({ name: '', description: '', is_active: true });
    const [saving, setSaving] = useState(false);

    const openCreate = () => {
        setEdit(null);
        setForm({ name: '', description: '', is_active: true });
        setOpen(true);
    };
    const openEdit = (t: Template) => {
        setEdit(t);
        setForm({ name: t.name, description: t.description ?? '', is_active: t.is_active });
        setOpen(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const url = edit ? `/supervision-templates/${edit.id}` : '/supervision-templates';
        const method = edit ? 'put' : 'post';
        router[method](url, form, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
            onSuccess: () => {
                setOpen(false);
                toast.success(edit ? 'تم تحديث القالب' : 'تم إنشاء القالب');
            },
        });
    };

    const confirmDelete = () => {
        if (!del) return;
        router.delete(`/supervision-templates/${del.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setDel(null);
                toast.success('تم حذف القالب');
            },
            onError: () => toast.error('لا يمكن حذف قالب استُخدم في زيارات'),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="قوالب الإشراف" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="قوالب استمارات الإشراف"
                    description="إدارة مجالات ومعايير استمارة الزيارة الصفية لكل قسم"
                    backHref="/settings"
                    actions={
                        <Button onClick={openCreate}>
                            <Plus className="size-4" /> إنشاء قالب
                        </Button>
                    }
                />

                {templates.length === 0 ? (
                    <Card>
                        <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
                            <FileText className="size-10" />
                            <p className="font-medium">لا توجد قوالب</p>
                            <p className="text-sm">ابدأ بإنشاء قالب استمارة إشراف</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {templates.map((t) => (
                            <Card key={t.id} className="flex flex-col">
                                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-bold">{t.name}</h3>
                                            {t.description && <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{t.description}</p>}
                                        </div>
                                        <Badge variant={t.is_active ? 'default' : 'secondary'}>{t.is_active ? 'مفعّل' : 'معطّل'}</Badge>
                                    </div>

                                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                                        <span className="flex items-center gap-1">
                                            <BookOpen className="size-4" /> {t.domains_count} مجال
                                        </span>
                                        <span>{t.standards_count} معيار</span>
                                        <span>{t.visits_count} زيارة</span>
                                    </div>

                                    {t.departments.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {t.departments.map((d) => (
                                                <Badge key={d.id} variant="secondary" className="gap-1">
                                                    <Link2 className="size-3" /> {d.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-2">
                                        <Button variant="ghost" size="sm" className="flex-1" asChild>
                                            <Link href={`/supervision-templates/${t.id}`}>
                                                إدارة المعايير <ChevronLeft className="size-4" />
                                            </Link>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="تعديل">
                                            <Pencil className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDel(t)}
                                            disabled={t.visits_count > 0}
                                            title={t.visits_count > 0 ? 'لا يمكن الحذف — يوجد زيارات' : 'حذف'}
                                            aria-label="حذف"
                                        >
                                            <Trash2 className="text-destructive size-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                    <ListEditor
                        title="أنواع المتابعة"
                        icon={ListChecks}
                        hint="نوع الزيارة الصفية الذي يُختار في الاستمارة (زيارة صفية، متابعة، …)."
                        initial={followUpTypes.map((t) => t.name)}
                        postUrl="/supervision-templates/follow-up-types"
                        field="types"
                        placeholder="اكتب نوع متابعة..."
                    />
                    <ListEditor
                        title="النصوص الجاهزة للتوصيات العامة"
                        icon={FileText}
                        hint="تظهر كأزرار في استمارة الزيارة لإدراجها بنقرة."
                        initial={notePresets.map((p) => p.text)}
                        postUrl="/supervision-templates/note-presets"
                        field="notes"
                        placeholder="اكتب نص التوصية الجاهز..."
                        multiline
                    />
                </div>
            </div>

            <FormDialog
                open={open}
                onOpenChange={setOpen}
                title={edit ? 'تعديل القالب' : 'إنشاء قالب جديد'}
                onSubmit={submit}
                loading={saving}
                submitLabel={edit ? 'تحديث' : 'إنشاء'}
            >
                <div className="space-y-2">
                    <Label htmlFor="name">اسم القالب</Label>
                    <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: قالب العلوم" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="desc">الوصف</Label>
                    <textarea
                        id="desc"
                        rows={3}
                        className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="وصف مختصر للقالب..."
                    />
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                    مفعّل
                </label>
            </FormDialog>

            <ConfirmDialog
                open={!!del}
                onOpenChange={(o) => !o && setDel(null)}
                title="حذف القالب"
                description={`سيتم حذف «${del?.name ?? ''}» وكل مجالاته ومعاييره. لا يمكن التراجع.`}
                confirmLabel="حذف"
                onConfirm={confirmDelete}
            />
        </AppLayout>
    );
}

/** محرّر قائمة نصوص بسيطة يُحفظ دفعة واحدة (للأنواع/النصوص الجاهزة). */
function ListEditor({
    title,
    icon: Icon,
    hint,
    initial,
    postUrl,
    field,
    placeholder,
    multiline = false,
}: {
    title: string;
    icon: typeof FileText;
    hint: string;
    initial: string[];
    postUrl: string;
    field: string;
    placeholder: string;
    multiline?: boolean;
}) {
    const [items, setItems] = useState<string[]>(initial.length ? initial : ['']);
    const [saving, setSaving] = useState(false);

    const update = (i: number, v: string) => setItems((arr) => arr.map((x, j) => (j === i ? v : x)));
    const add = () => setItems((arr) => [...arr, '']);
    const remove = (i: number) => setItems((arr) => arr.filter((_, j) => j !== i));

    const save = () => {
        setSaving(true);
        router.post(
            postUrl,
            { [field]: items.filter((x) => x.trim() !== '') },
            { preserveScroll: true, onFinish: () => setSaving(false), onSuccess: () => toast.success('تم الحفظ') },
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="size-4" /> {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-muted-foreground text-xs">{hint}</p>
                {items.map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-2.5 w-5 text-center text-xs font-bold">{i + 1}</span>
                        {multiline ? (
                            <textarea
                                value={text}
                                onChange={(e) => update(i, e.target.value)}
                                rows={1}
                                className="border-input bg-background flex-1 rounded-xl border px-3 py-2 text-sm"
                                placeholder={placeholder}
                            />
                        ) : (
                            <Input value={text} onChange={(e) => update(i, e.target.value)} className="flex-1" placeholder={placeholder} />
                        )}
                        <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="حذف">
                            <Trash2 className="text-destructive size-4" />
                        </Button>
                    </div>
                ))}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={add}>
                        <Plus className="size-4" /> إضافة
                    </Button>
                    <Button size="sm" onClick={save} disabled={saving}>
                        <Save className="size-4" /> {saving ? 'جارٍ الحفظ...' : 'حفظ'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
