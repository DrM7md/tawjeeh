import { FormDialog } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type CalendarEventType } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Lock, MapPin, Pencil, Settings2, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

/* ===================== الأنواع ===================== */
type Priority = 'normal' | 'medium' | 'urgent' | 'critical';
type Audience = 'personal' | 'all' | 'department_heads' | 'specific';

interface Assignee {
    id: number;
    name: string | null;
    department: string | null;
    status: 'pending' | 'done';
    completed_at: string | null;
}

interface Task {
    id: number;
    title: string;
    description: string | null;
    event_type: { id: number; name: string; color: string | null; has_time: boolean } | null;
    priority: Priority;
    audience: Audience;
    color: string | null;
    start_date: string;
    due_date: string | null;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    creator: { id: number; name: string | null };
    can_edit: boolean;
    assignees: Assignee[];
    assignee_ids: number[];
    done_count: number;
    total_count: number;
    my_status: 'pending' | 'done' | null;
}

interface AssignableUser {
    id: number;
    name: string;
    department: string | null;
}

interface Props {
    tasks: Task[];
    canAssign: boolean;
    canManageTypes: boolean;
    eventTypes: CalendarEventType[];
    assignableUsers: AssignableUser[];
}

/* ===================== ثوابت العرض ===================== */
const PRIORITY: Record<Priority, { label: string; color: string }> = {
    critical: { label: 'شديد الأهمية', color: '#dc2626' },
    urgent: { label: 'عاجل', color: '#ea580c' },
    medium: { label: 'متوسط', color: '#ca8a04' },
    normal: { label: 'عادي', color: '#2563eb' },
};
const PERSONAL_COLOR = '#7c3aed';
const DONE_COLOR = '#94a3b8'; // رصاصي للمهمة المنتهية
const AUDIENCE: Record<Audience, string> = {
    personal: 'مهمة شخصية',
    all: 'الجميع',
    department_heads: 'رؤساء الأقسام',
    specific: 'مستخدمون محددون',
};
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const taskColor = (t: Pick<Task, 'audience' | 'priority' | 'color'>) =>
    t.color || (t.audience === 'personal' ? PERSONAL_COLOR : PRIORITY[t.priority].color);

/* ===================== أدوات التاريخ ===================== */
const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = toKey(new Date());

/** نص عربي ودود لتاريخ ISO (YYYY-MM-DD). */
function arabicDate(key: string | null): string {
    if (!key) return '—';
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'التقويم', href: '/calendar' },
];

/* ===================== نموذج المهمة (إضافة/تعديل) ===================== */
interface FormState {
    title: string;
    description: string;
    calendar_event_type_id: string;
    priority: Priority;
    audience: Audience;
    start_date: string;
    due_date: string;
    start_time: string;
    end_time: string;
    location: string;
    assignee_ids: number[];
}

const emptyForm = (date: string, defaultTypeId: string): FormState => ({
    title: '',
    description: '',
    calendar_event_type_id: defaultTypeId,
    priority: 'normal',
    audience: 'personal',
    start_date: date,
    due_date: '',
    start_time: '',
    end_time: '',
    location: '',
    assignee_ids: [],
});

const inputClass =
    'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1';

function TaskFormDialog({
    open,
    onOpenChange,
    initial,
    editingId,
    canAssign,
    canManageTypes,
    eventTypes,
    assignableUsers,
}: Readonly<{
    open: boolean;
    onOpenChange: (o: boolean) => void;
    initial: FormState;
    editingId: number | null;
    canAssign: boolean;
    canManageTypes: boolean;
    eventTypes: CalendarEventType[];
    assignableUsers: AssignableUser[];
}>) {
    const [form, setForm] = useState<FormState>(initial);
    const [processing, setProcessing] = useState(false);

    // أعِد ضبط الحقول كلما فُتحت النافذة بقيمة ابتدائية جديدة.
    const [seed, setSeed] = useState(initial.start_date + ':' + editingId);
    const currentSeed = initial.start_date + ':' + editingId;
    if (open && seed !== currentSeed) {
        setSeed(currentSeed);
        setForm(initial);
    }

    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

    const selectedType = eventTypes.find((t) => String(t.id) === form.calendar_event_type_id) ?? null;
    const showTimeFields = !!selectedType?.has_time || !!form.start_time || !!form.end_time || !!form.location;

    const userItems = useMemo(
        () =>
            assignableUsers
                .filter((u) => !form.assignee_ids.includes(u.id))
                .map((u) => ({ value: String(u.id), label: `${u.name}${u.department ? ' — ' + u.department : ''}` })),
        [assignableUsers, form.assignee_ids],
    );
    const usersById = useMemo(() => new Map(assignableUsers.map((u) => [u.id, u])), [assignableUsers]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) {
            toast.error('عنوان المهمة مطلوب');
            return;
        }
        if (form.audience === 'specific' && form.assignee_ids.length === 0) {
            toast.error('اختر مستخدمًا واحدًا على الأقل');
            return;
        }
        setProcessing(true);
        const payload = { ...form };
        const opts = {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(editingId ? 'تم تحديث المهمة' : 'تمت إضافة المهمة');
                onOpenChange(false);
            },
            onError: () => toast.error('تعذّر حفظ المهمة'),
            onFinish: () => setProcessing(false),
        };
        if (editingId) {
            router.put(`/calendar/${editingId}`, payload, opts);
        } else {
            router.post('/calendar', payload, opts);
        }
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title={editingId ? 'تعديل المهمة' : 'مهمة جديدة'}
            description="العنوان والتاريخ فقط مطلوبان — بقية الحقول اختيارية"
            onSubmit={submit}
            loading={processing}
            submitLabel={editingId ? 'حفظ التعديلات' : 'إضافة المهمة'}
        >
            {/* العنوان */}
            <div className="space-y-2">
                <Label htmlFor="title">عنوان المهمة *</Label>
                <input id="title" className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="مثال: اجتماع رؤساء الأقسام، إنجاز تقرير الزيارات…" autoFocus />
            </div>

            {/* النوع + الأولوية */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="event_type">نوع الحدث</Label>
                        {canManageTypes && (
                            <Link href="/organization-settings" className="text-primary flex items-center gap-1 text-xs hover:underline">
                                <Settings2 className="size-3" /> إعداد الأنواع
                            </Link>
                        )}
                    </div>
                    <select id="event_type" className={inputClass} value={form.calendar_event_type_id} onChange={(e) => set('calendar_event_type_id', e.target.value)}>
                        <option value="">بدون نوع</option>
                        {eventTypes.map((t) => (
                            <option key={t.id} value={String(t.id)}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="priority">الأولوية</Label>
                    <select id="priority" className={inputClass} value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                        {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                            <option key={p} value={p}>{PRIORITY[p].label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* التاريخ + الموعد النهائي */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="start_date">التاريخ *</Label>
                    <input id="start_date" type="date" className={inputClass} value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="due_date">الموعد النهائي (اختياري)</Label>
                    <input id="due_date" type="date" className={inputClass} value={form.due_date} min={form.start_date} onChange={(e) => set('due_date', e.target.value)} />
                </div>
            </div>

            {/* الوقت — يظهر تلقائيًا للأنواع التي تتطلّب وقتًا (مثل الاجتماعات)، ومتاح دائمًا */}
            {showTimeFields && (
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="start_time">من</Label>
                        <input id="start_time" type="time" className={inputClass} value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="end_time">إلى</Label>
                        <input id="end_time" type="time" className={inputClass} value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="location">المكان</Label>
                        <input id="location" className={inputClass} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="القاعة…" />
                    </div>
                </div>
            )}
            {!showTimeFields && (
                <button type="button" className="text-primary text-xs hover:underline" onClick={() => set('start_time', '00:00')}>
                    + إضافة وقت ومكان
                </button>
            )}

            {/* الوصف */}
            <div className="space-y-2">
                <Label htmlFor="description">وصف المهمة (اختياري)</Label>
                <textarea
                    id="description"
                    rows={3}
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="تفاصيل ما هو مطلوب إنجازه…"
                />
            </div>

            {/* الإسناد */}
            {canAssign && (
                <div className="space-y-2 rounded-lg border border-dashed p-3">
                    <Label htmlFor="audience">إسناد المهمة إلى</Label>
                    <select id="audience" className={inputClass} value={form.audience} onChange={(e) => set('audience', e.target.value as Audience)}>
                        {(Object.keys(AUDIENCE) as Audience[]).map((a) => (
                            <option key={a} value={a}>{AUDIENCE[a]}</option>
                        ))}
                    </select>
                    {form.audience === 'personal' && <p className="text-muted-foreground text-xs">مهمة خاصة بك — لا يراها أحد غيرك.</p>}
                    {form.audience === 'all' && <p className="text-muted-foreground text-xs">ستصل لجميع مستخدمي النظام النشطين.</p>}
                    {form.audience === 'department_heads' && <p className="text-muted-foreground text-xs">ستصل لرؤساء الأقسام فقط.</p>}

                    {form.audience === 'specific' && (
                        <div className="space-y-2 pt-1">
                            <Combobox items={userItems} value="" onChange={(v) => v && set('assignee_ids', [...form.assignee_ids, Number(v)])} placeholder="ابحث عن موجّه أو مستخدم…" emptyText="لا مزيد من المستخدمين" anchor="top start" />
                            {form.assignee_ids.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {form.assignee_ids.map((id) => {
                                        const u = usersById.get(id);
                                        return (
                                            <Badge key={id} variant="secondary" className="gap-1">
                                                {u?.name ?? id}
                                                {u?.department ? <span className="opacity-60">· {u.department}</span> : null}
                                                <button type="button" className="hover:text-destructive ml-0.5" onClick={() => set('assignee_ids', form.assignee_ids.filter((x) => x !== id))} aria-label="إزالة">
                                                    ×
                                                </button>
                                            </Badge>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </FormDialog>
    );
}

/* ===================== نافذة التفاصيل ===================== */
function TaskDetailsDialog({
    task,
    onOpenChange,
    onEdit,
}: Readonly<{ task: Task | null; onOpenChange: (o: boolean) => void; onEdit: (t: Task) => void }>) {
    if (!task) return null;
    const color = taskColor(task);

    const toggle = () => {
        router.post(`/calendar/${task.id}/toggle`, {}, { preserveScroll: true, onSuccess: () => toast.success('تم تحديث حالتك') });
    };
    const remove = () => {
        if (!confirm('حذف هذه المهمة نهائيًا؟')) return;
        router.delete(`/calendar/${task.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('تم حذف المهمة');
                onOpenChange(false);
            },
        });
    };

    const timeRange = task.start_time ? `${task.start_time}${task.end_time ? ' — ' + task.end_time : ''}` : null;

    return (
        <Dialog open={!!task} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        {task.title}
                    </DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Badge variant="outline" style={{ borderColor: color, color }}>{PRIORITY[task.priority].label}</Badge>
                        {task.event_type && (
                            <Badge
                                variant="outline"
                                style={task.event_type.color ? { borderColor: task.event_type.color, color: task.event_type.color } : undefined}
                            >
                                {task.event_type.name}
                            </Badge>
                        )}
                        <Badge variant="secondary" className="gap-1">
                            {task.audience === 'personal' ? <Lock className="size-3" /> : <Users className="size-3" />}
                            {AUDIENCE[task.audience]}
                        </Badge>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-1 text-sm">
                    {task.description && <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>}

                    <div className="grid gap-2 sm:grid-cols-2">
                        <div className="bg-muted/40 rounded-lg p-2.5">
                            <p className="text-muted-foreground text-xs">التاريخ</p>
                            <p className="font-medium">{arabicDate(task.start_date)}</p>
                        </div>
                        {task.due_date && (
                            <div className="bg-muted/40 rounded-lg p-2.5">
                                <p className="text-muted-foreground text-xs">الموعد النهائي</p>
                                <p className="font-medium">{arabicDate(task.due_date)}</p>
                            </div>
                        )}
                    </div>

                    {(timeRange || task.location) && (
                        <div className="text-muted-foreground flex flex-wrap items-center gap-4">
                            {timeRange && (
                                <span className="flex items-center gap-1.5">
                                    <Clock className="size-4" /> {timeRange}
                                </span>
                            )}
                            {task.location && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="size-4" /> {task.location}
                                </span>
                            )}
                        </div>
                    )}

                    {task.creator.name && (
                        <p className="text-muted-foreground text-xs">أنشأها: {task.creator.name}</p>
                    )}

                    {/* تتبّع الإنجاز للمهام المُسندة */}
                    {task.audience !== 'personal' && task.total_count > 0 && (
                        <div className="space-y-2 rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                                <p className="font-medium">متابعة الإنجاز</p>
                                <Badge variant={task.done_count === task.total_count ? 'default' : 'secondary'}>
                                    أنجزها {task.done_count} من {task.total_count}
                                </Badge>
                            </div>
                            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                                <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${task.total_count ? (task.done_count / task.total_count) * 100 : 0}%` }} />
                            </div>
                            <ul className="max-h-40 space-y-1 overflow-y-auto pt-1">
                                {task.assignees.map((a) => (
                                    <li key={a.id} className="flex items-center justify-between text-xs">
                                        <span>
                                            {a.name}
                                            {a.department ? <span className="text-muted-foreground"> · {a.department}</span> : null}
                                        </span>
                                        {a.status === 'done' ? (
                                            <span className="font-medium text-emerald-600">✓ منتهٍ</span>
                                        ) : (
                                            <span className="text-muted-foreground">⏳ قيد العمل</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex gap-2">
                        {task.can_edit && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => onEdit(task)}>
                                    <Pencil className="size-4" /> تعديل
                                </Button>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
                                    <Trash2 className="size-4" /> حذف
                                </Button>
                            </>
                        )}
                    </div>
                    {task.my_status !== null && (
                        <Button size="sm" variant={task.my_status === 'done' ? 'outline' : 'default'} onClick={toggle}>
                            {task.my_status === 'done' ? 'إلغاء الإنجاز' : 'تمييز كمنجَز'}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ===================== شريحة المهمة داخل اليوم ===================== */
function TaskChip({ task, onClick, onDragStart }: Readonly<{ task: Task; onClick: (e: React.MouseEvent) => void; onDragStart: (e: React.DragEvent) => void }>) {
    const mineDone = task.my_status === 'done';
    // منتهية: حالتي إن كنت مُسنَدًا، أو اكتمال الجميع إن كنت المُنشئ المتابِع.
    const done = mineDone || (task.my_status === null && task.total_count > 0 && task.done_count === task.total_count);
    const color = done ? DONE_COLOR : taskColor(task);
    const canToggle = task.my_status !== null;

    const toggle = (e: React.MouseEvent | React.ChangeEvent) => {
        e.stopPropagation();
        router.post(`/calendar/${task.id}/toggle`, {}, { preserveScroll: true });
    };

    return (
        <div
            role="button"
            tabIndex={0}
            draggable={task.can_edit}
            onDragStart={onDragStart}
            onClick={onClick}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(e as unknown as React.MouseEvent)}
            className={cn('flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-right text-xs transition hover:brightness-95', task.can_edit && 'cursor-grab active:cursor-grabbing')}
            style={{ backgroundColor: `${color}1f`, borderInlineStart: `3px solid ${color}` }}
            title={task.title}
        >
            {canToggle && (
                <input
                    type="checkbox"
                    checked={mineDone}
                    onClick={(e) => e.stopPropagation()}
                    onChange={toggle}
                    className="size-3 shrink-0 cursor-pointer"
                    style={{ accentColor: color }}
                    aria-label="تمييز كمنجَز"
                />
            )}
            {task.audience === 'personal' && <Lock className="size-3 shrink-0 opacity-60" />}
            {task.start_time && <span className="shrink-0 tabular-nums opacity-70">{task.start_time}</span>}
            <span className={cn('truncate', done && 'line-through opacity-70')}>{task.title}</span>
        </div>
    );
}

/* ===================== الصفحة ===================== */
export default function CalendarIndex({ tasks, canAssign, canManageTypes, eventTypes, assignableUsers }: Readonly<Props>) {
    const now = new Date();
    const defaultTypeId = String(eventTypes.find((t) => t.is_default)?.id ?? eventTypes[0]?.id ?? '');
    const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
    const [dragOverKey, setDragOverKey] = useState<string | null>(null);

    const [formOpen, setFormOpen] = useState(false);
    const [formInitial, setFormInitial] = useState<FormState>(emptyForm(todayKey, defaultTypeId));
    const [editingId, setEditingId] = useState<number | null>(null);
    const [details, setDetails] = useState<Task | null>(null);

    // المهام مجمّعة حسب اليوم.
    const byDay = useMemo(() => {
        const map = new Map<string, Task[]>();
        for (const t of tasks) {
            const arr = map.get(t.start_date) ?? [];
            arr.push(t);
            map.set(t.start_date, arr);
        }
        for (const arr of map.values()) {
            arr.sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99'));
        }
        return map;
    }, [tasks]);

    // 42 خلية تبدأ من الأحد.
    const cells = useMemo(() => {
        const first = new Date(view.y, view.m, 1);
        const start = new Date(view.y, view.m, 1 - first.getDay());
        return Array.from({ length: 42 }, (_, i) => {
            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            return { date: d, key: toKey(d), inMonth: d.getMonth() === view.m };
        });
    }, [view]);

    const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString('ar', { month: 'long', year: 'numeric' });

    const goToday = () => setView({ y: now.getFullYear(), m: now.getMonth() });
    const shift = (delta: number) => setView((v) => {
        const d = new Date(v.y, v.m + delta, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
    });

    const openCreate = (date: string) => {
        setEditingId(null);
        setFormInitial(emptyForm(date, defaultTypeId));
        setFormOpen(true);
    };
    const openEdit = (t: Task) => {
        setDetails(null);
        setEditingId(t.id);
        setFormInitial({
            title: t.title,
            description: t.description ?? '',
            calendar_event_type_id: t.event_type ? String(t.event_type.id) : '',
            priority: t.priority,
            audience: t.audience,
            start_date: t.start_date,
            due_date: t.due_date ?? '',
            start_time: t.start_time ?? '',
            end_time: t.end_time ?? '',
            location: t.location ?? '',
            assignee_ids: t.assignee_ids,
        });
        setFormOpen(true);
    };

    const onDrop = (e: React.DragEvent, key: string) => {
        e.preventDefault();
        setDragOverKey(null);
        const id = e.dataTransfer.getData('text/plain');
        if (!id) return;
        const task = tasks.find((t) => String(t.id) === id);
        if (!task || task.start_date === key) return;
        router.post(`/calendar/${id}/move`, { start_date: key }, { preserveScroll: true, onSuccess: () => toast.success('تم نقل المهمة') });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="التقويم" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="التقويم"
                    description="مهامك الشخصية والمهام المُسندة — اسحب أي مهمة لتغيير يومها، أو اضغط على يوم لإضافة مهمة"
                    actions={
                        <Button onClick={() => openCreate(todayKey)}>
                            <CalendarPlus className="size-4" /> مهمة جديدة
                        </Button>
                    }
                />

                {/* شريط التنقل بين الأشهر */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="الشهر السابق">
                            <ChevronRight className="size-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="الشهر التالي">
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToday}>اليوم</Button>
                    </div>
                    <h2 className="text-lg font-semibold">{monthLabel}</h2>
                </div>

                {/* الشبكة */}
                <div className="overflow-hidden rounded-xl border">
                    <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium">
                        {WEEKDAYS.map((d) => (
                            <div key={d} className="py-2">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {cells.map((cell) => {
                            const dayTasks = byDay.get(cell.key) ?? [];
                            const isToday = cell.key === todayKey;
                            return (
                                <div
                                    key={cell.key}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openCreate(cell.key)}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openCreate(cell.key)}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverKey(cell.key); }}
                                    onDragLeave={() => setDragOverKey((k) => (k === cell.key ? null : k))}
                                    onDrop={(e) => onDrop(e, cell.key)}
                                    className={cn(
                                        'group relative flex min-h-28 cursor-pointer flex-col gap-1 border-b border-l p-1.5 text-right align-top transition last:border-l-0 hover:bg-muted/30',
                                        !cell.inMonth && 'bg-muted/20 text-muted-foreground',
                                        dragOverKey === cell.key && 'bg-primary/10 ring-primary ring-2 ring-inset',
                                    )}
                                >
                                    <span className={cn('flex size-6 items-center justify-center self-start rounded-full text-xs', isToday && 'bg-primary text-primary-foreground font-bold')}>
                                        {cell.date.getDate()}
                                    </span>
                                    <div className="flex max-h-24 flex-col gap-1 overflow-y-auto">
                                        {dayTasks.map((t) => (
                                            <TaskChip
                                                key={t.id}
                                                task={t}
                                                onClick={(e) => { e.stopPropagation(); setDetails(t); }}
                                                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* مفتاح الألوان */}
                <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded-full" style={{ backgroundColor: PERSONAL_COLOR }} /> مهمة شخصية
                    </span>
                    {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                        <span key={p} className="flex items-center gap-1.5">
                            <span className="size-3 rounded-full" style={{ backgroundColor: PRIORITY[p].color }} /> {PRIORITY[p].label}
                        </span>
                    ))}
                </div>
            </div>

            <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} initial={formInitial} editingId={editingId} canAssign={canAssign} canManageTypes={canManageTypes} eventTypes={eventTypes} assignableUsers={assignableUsers} />
            <TaskDetailsDialog task={details} onOpenChange={(o) => !o && setDetails(null)} onEdit={openEdit} />
        </AppLayout>
    );
}
