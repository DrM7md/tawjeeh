import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { BookOpen, ChevronDown, ClipboardCheck, FileText, MessageSquare, Save, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface TeacherOpt {
    id: number;
    name: string;
    school: string | null;
    department: string | null;
}
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
interface TemplateData {
    id: number;
    name: string;
    domains: Domain[];
}
interface PrevRec {
    id: number;
    date: string | null;
    year: string | null;
    overall_rating: string | number | null;
    general_notes: string | null;
    recommendations: { standard: string | null; text: string }[];
}
interface TeacherContext {
    template: TemplateData | null;
    visit_number: number;
    total_visits: number;
    previous_rating: string | number | null;
    previous_recommendations: PrevRec[];
}
interface EditVisit {
    id: number;
    teacher_id: number;
    teacher_name: string;
    visit_date: string | null;
    follow_up_type: string | null;
    section: string | null;
    lesson_topic: string | null;
    general_notes: string | null;
    ratings: { standard_id: number; rating_value: number; recommendation: string | null }[];
}
interface PageProps {
    teachers: TeacherOpt[];
    followUpTypes: string[];
    notePresets: string[];
    ratingLabels: Record<string, string>;
    visitorName: string;
    editVisit: EditVisit | null;
    preselectedTeacherId: number | null;
    teacherContext: TeacherContext | null;
}

interface RatingState {
    rating_value: number;
    recommendation: string;
}

const RATING_STYLE: Record<number, { dot: string; on: string }> = {
    4: { dot: 'bg-green-600', on: 'border-green-600 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
    3: { dot: 'bg-blue-600', on: 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    2: { dot: 'bg-amber-500', on: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    1: { dot: 'bg-red-500', on: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
};

function pctTone(v: number | null): string {
    if (v == null) return 'text-muted-foreground';
    if (v >= 90) return 'text-green-600';
    if (v >= 75) return 'text-blue-600';
    if (v >= 60) return 'text-amber-600';
    return 'text-red-600';
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function percent(values: number[]): number | null {
    const measured = values.filter((v) => v > 0);
    if (measured.length === 0) return null;
    return Math.round((measured.reduce((s, v) => s + v, 0) / (measured.length * 4)) * 1000) / 10;
}

export default function VisitForm({
    teachers,
    followUpTypes,
    notePresets,
    ratingLabels,
    visitorName,
    editVisit,
    preselectedTeacherId,
    teacherContext,
}: PageProps) {
    const isEdit = !!editVisit;

    const [teacherId, setTeacherId] = useState<string>(preselectedTeacherId ? String(preselectedTeacherId) : '');
    const [ctx, setCtx] = useState<TeacherContext | null>(teacherContext);
    const [loadingCtx, setLoadingCtx] = useState(false);
    const [saving, setSaving] = useState(false);

    const [visitDate, setVisitDate] = useState(editVisit?.visit_date ?? todayISO());
    const [followUpType, setFollowUpType] = useState(editVisit?.follow_up_type ?? '');
    const [section, setSection] = useState(editVisit?.section ?? '');
    const [lessonTopic, setLessonTopic] = useState(editVisit?.lesson_topic ?? '');
    const [generalNotes, setGeneralNotes] = useState(editVisit?.general_notes ?? '');

    const [ratings, setRatings] = useState<Record<number, RatingState>>(() => {
        const init: Record<number, RatingState> = {};
        editVisit?.ratings.forEach((r) => {
            init[r.standard_id] = { rating_value: r.rating_value, recommendation: r.recommendation ?? '' };
        });
        return init;
    });
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

    const template = ctx?.template ?? null;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'الزيارات', href: '/visits' },
        { title: isEdit ? 'تعديل زيارة' : 'زيارة جديدة', href: '/visits/create' },
    ];

    const loadContext = async (id: string) => {
        setLoadingCtx(true);
        try {
            const url = `/visits/teacher-context?teacher_id=${id}${isEdit ? `&exclude_visit_id=${editVisit!.id}` : ''}`;
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            setCtx(await res.json());
        } catch {
            setCtx(null);
            toast.error('تعذّر تحميل قالب المعلم');
        } finally {
            setLoadingCtx(false);
        }
    };

    const onTeacherChange = (id: string) => {
        setTeacherId(id);
        setRatings({});
        if (id) loadContext(id);
        else setCtx(null);
    };

    const setRating = (standardId: number, value: number) =>
        setRatings((prev) => ({ ...prev, [standardId]: { ...prev[standardId], rating_value: value, recommendation: prev[standardId]?.recommendation ?? '' } }));
    const setRec = (standardId: number, text: string) =>
        setRatings((prev) => ({ ...prev, [standardId]: { rating_value: prev[standardId]?.rating_value ?? 0, recommendation: text } }));
    const appendRec = (standardId: number, text: string) =>
        setRatings((prev) => {
            const cur = prev[standardId]?.recommendation ?? '';
            if (cur.includes(text)) return prev;
            return { ...prev, [standardId]: { rating_value: prev[standardId]?.rating_value ?? 0, recommendation: cur ? `${cur} / ${text}` : text } };
        });
    const appendNote = (text: string) => setGeneralNotes((cur) => (cur ? `${cur}\n${text}` : text));

    const toggleDomain = (id: number) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const overall = useMemo(() => percent(Object.values(ratings).map((r) => r.rating_value)), [ratings]);
    const domainPct = (d: Domain) => percent(d.standards.map((s) => ratings[s.id]?.rating_value ?? 0));

    const dayName = useMemo(() => {
        if (!visitDate) return '';
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const d = new Date(visitDate);
        return Number.isNaN(d.getTime()) ? '' : days[d.getDay()];
    }, [visitDate]);

    const canSave = !!teacherId && !!visitDate && !!followUpType && !!template && !saving;

    const submit = () => {
        if (!template) return;
        const ratingsArray = template.domains
            .flatMap((d) => d.standards)
            .map((s) => ({
                standard_id: s.id,
                rating_value: ratings[s.id]?.rating_value ?? 0,
                recommendation: ratings[s.id]?.recommendation || null,
            }));
        const payload = {
            teacher_id: Number(teacherId),
            visit_date: visitDate,
            follow_up_type: followUpType,
            section,
            lesson_topic: lessonTopic,
            general_notes: generalNotes,
            ratings: ratingsArray,
        };
        setSaving(true);
        const opts = {
            onFinish: () => setSaving(false),
            onSuccess: () => toast.success(isEdit ? 'تم تحديث الزيارة' : 'تم حفظ الزيارة'),
        };
        if (isEdit) router.put(`/visits/${editVisit!.id}`, payload, opts);
        else router.post('/visits', payload, opts);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEdit ? 'تعديل زيارة إشرافية' : 'زيارة إشرافية جديدة'} />
            <div className="flex flex-col gap-5 p-4 md:p-6">
                <PageHeader
                    title={isEdit ? 'تعديل الزيارة الإشرافية' : 'استمارة الإشراف على أداء المعلم'}
                    description="تعبئة استمارة تقييم أداء المعلم أثناء الحصة الصفية"
                    backHref="/visits"
                    actions={
                        overall !== null && (
                            <div className={cn('rounded-xl border-2 px-4 py-1.5 text-center', overall >= 75 ? 'border-blue-500' : overall >= 60 ? 'border-amber-500' : 'border-red-500')}>
                                <div className={cn('text-2xl font-black tnum', pctTone(overall))}>{overall}%</div>
                                <div className="text-muted-foreground text-[10px]">التقييم الكلي</div>
                            </div>
                        )
                    }
                />

                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex flex-col gap-5">
                        {/* البيانات الأساسية */}
                        <Card>
                            <CardContent className="space-y-5 p-5">
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label>المعلم {!isEdit && <span className="text-destructive">*</span>}</Label>
                                        {isEdit ? (
                                            <Input value={editVisit!.teacher_name} disabled />
                                        ) : (
                                            <Combobox
                                                items={teachers.map((t) => ({ value: String(t.id), label: `${t.name}${t.school ? ` — ${t.school}` : ''}` }))}
                                                value={teacherId}
                                                onChange={onTeacherChange}
                                                placeholder="ابحث عن المعلم..."
                                                emptyText="لا معلمون في نطاقك"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="vdate">التاريخ <span className="text-destructive">*</span></Label>
                                        <Input id="vdate" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                                        {dayName && <span className="text-primary text-xs">{dayName}</span>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>نوع المتابعة <span className="text-destructive">*</span></Label>
                                        <Select value={followUpType} onValueChange={setFollowUpType}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر النوع" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {followUpTypes.map((t) => (
                                                    <SelectItem key={t} value={t}>
                                                        {t}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="section">الشعبة الصفية</Label>
                                        <Input id="section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="مثال: أ / ب" />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <Label htmlFor="lesson">موضوع الدرس</Label>
                                        <Input id="lesson" value={lessonTopic} onChange={(e) => setLessonTopic(e.target.value)} placeholder="موضوع الحصة..." />
                                    </div>
                                </div>

                                {/* شريط معلومات الزائر + الإحصائيات */}
                                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-4">
                                    <Stat label="الزائر" value={visitorName} />
                                    <Stat label="رقم الزيارة" value={ctx ? String(ctx.visit_number) : '—'} accent />
                                    <Stat label="الزيارات السابقة" value={ctx ? String(ctx.total_visits) : '—'} />
                                    <Stat label="تقييم سابق" value={ctx?.previous_rating != null ? `${ctx.previous_rating}%` : '—'} accent />
                                </div>
                            </CardContent>
                        </Card>

                        {/* المعايير */}
                        {loadingCtx && (
                            <Card>
                                <CardContent className="text-muted-foreground animate-pulse p-10 text-center">جارٍ تحميل القالب...</CardContent>
                            </Card>
                        )}
                        {!loadingCtx && teacherId && !template && (
                            <Card>
                                <CardContent className="text-muted-foreground p-10 text-center">
                                    <BookOpen className="mx-auto mb-2 size-10 opacity-40" />
                                    لا يوجد قالب مرتبط بقسم هذا المعلم. اربط قالباً من <a href="/supervision-templates" className="text-primary hover:underline">إدارة القوالب</a>.
                                </CardContent>
                            </Card>
                        )}
                        {template && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <ClipboardCheck className="text-primary size-5" />
                                    <h2 className="text-lg font-semibold">معايير الأداء</h2>
                                    <Badge variant="secondary">{template.name}</Badge>
                                </div>
                                {template.domains.map((domain, dIdx) => {
                                    const isOpen = !collapsed.has(domain.id);
                                    const pct = domainPct(domain);
                                    return (
                                        <Card key={domain.id} className="overflow-hidden p-0">
                                            <button type="button" onClick={() => toggleDomain(domain.id)} className="flex w-full items-center justify-between gap-2 bg-muted/30 px-4 py-3 hover:bg-accent">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg text-sm font-bold">{dIdx + 1}</span>
                                                    <span className="font-bold">{domain.name}</span>
                                                    <span className="text-muted-foreground text-xs">{domain.standards.length} معيار</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {pct !== null && <span className={cn('tnum text-sm font-bold', pctTone(pct))}>{pct}%</span>}
                                                    <ChevronDown className={cn('text-muted-foreground size-5 transition-transform', !isOpen && '-rotate-90')} />
                                                </div>
                                            </button>
                                            {isOpen && (
                                                <div className="divide-y divide-border/60">
                                                    {domain.standards.map((std, sIdx) => {
                                                        const r = ratings[std.id];
                                                        return (
                                                            <div key={std.id} className="space-y-3 p-4">
                                                                <div className="flex items-start gap-3">
                                                                    <span className="bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded text-xs font-bold tnum">
                                                                        {dIdx + 1}.{sIdx + 1}
                                                                    </span>
                                                                    <p className="flex-1 text-sm leading-relaxed">{std.name}</p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1.5 pr-9">
                                                                    {[1, 2, 3, 4].map((v) => {
                                                                        const selected = r?.rating_value === v;
                                                                        return (
                                                                            <button
                                                                                key={v}
                                                                                type="button"
                                                                                onClick={() => setRating(std.id, selected ? 0 : v)}
                                                                                className={cn(
                                                                                    'flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition',
                                                                                    selected ? RATING_STYLE[v].on : 'border-border text-muted-foreground hover:border-foreground/30',
                                                                                )}
                                                                            >
                                                                                <span className={cn('inline-block size-2 rounded-full', selected ? RATING_STYLE[v].dot : 'bg-muted-foreground/30')} />
                                                                                {ratingLabels[String(v)]}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="space-y-1.5 pr-9">
                                                                    <textarea
                                                                        value={r?.recommendation ?? ''}
                                                                        onChange={(e) => setRec(std.id, e.target.value)}
                                                                        rows={1}
                                                                        placeholder="التوصية..."
                                                                        className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
                                                                    />
                                                                    {std.recommendations.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {std.recommendations.map((rec) => (
                                                                                <button
                                                                                    key={rec.id}
                                                                                    type="button"
                                                                                    onClick={() => appendRec(std.id, rec.text)}
                                                                                    className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                                                                                >
                                                                                    + {rec.text}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        )}

                        {/* ملاحظات عامة + حفظ */}
                        <Card>
                            <CardContent className="space-y-4 p-5">
                                <div className="flex items-center gap-2">
                                    <FileText className="text-muted-foreground size-4" />
                                    <h2 className="font-semibold">ملاحظات وتوصيات عامة</h2>
                                </div>
                                <textarea
                                    value={generalNotes}
                                    onChange={(e) => setGeneralNotes(e.target.value)}
                                    rows={4}
                                    className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                                    placeholder="ملاحظات عامة على أداء المعلم..."
                                />
                                {notePresets.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-muted-foreground text-xs font-semibold">نصوص جاهزة (اضغط للإدراج):</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {notePresets.map((text) => (
                                                <button
                                                    key={text}
                                                    type="button"
                                                    onClick={() => appendNote(text)}
                                                    title={text}
                                                    className="max-w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-right text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                                                >
                                                    <span className="line-clamp-1">+ {text}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                                    <a href="/visits" className="text-muted-foreground hover:text-foreground text-sm">إلغاء والعودة</a>
                                    <Button onClick={submit} disabled={!canSave} size="lg">
                                        <Save className="size-4" /> {saving ? 'جارٍ الحفظ...' : isEdit ? 'تحديث الزيارة' : 'حفظ الزيارة'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* لوحة جانبية: التوصيات السابقة */}
                    <aside className="xl:sticky xl:top-4">
                        <Card>
                            <CardContent className="space-y-3 p-4">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="text-amber-600 size-4" />
                                    <h2 className="text-sm font-bold">التوصيات السابقة</h2>
                                </div>
                                {!teacherId ? (
                                    <p className="text-muted-foreground py-6 text-center text-xs">اختر المعلم لعرض توصياته السابقة</p>
                                ) : !ctx || ctx.previous_recommendations.length === 0 ? (
                                    <p className="text-muted-foreground py-6 text-center text-xs">لا توجد زيارات سابقة لهذا المعلم</p>
                                ) : (
                                    <div className="max-h-[70vh] space-y-3 overflow-y-auto">
                                        {ctx.previous_recommendations.map((v) => (
                                            <div key={v.id} className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-bold">{v.year ?? ''} · {v.date}</span>
                                                    {v.overall_rating != null && <Badge variant="secondary" className="text-[10px]">{v.overall_rating}%</Badge>}
                                                </div>
                                                {v.recommendations.map((rec, ri) => (
                                                    <div key={ri} className="mb-1 text-[11px] leading-relaxed">
                                                        <span className="font-bold text-amber-600">• {rec.standard}:</span> {rec.text}
                                                    </div>
                                                ))}
                                                {v.general_notes && <p className="text-muted-foreground mt-1.5 border-t border-border/60 pt-1.5 text-[11px]">{v.general_notes}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="bg-card p-3 text-center">
            <div className="text-muted-foreground text-[11px]">{label}</div>
            <div className={cn('truncate text-sm font-bold', accent && 'text-primary')}>{value}</div>
        </div>
    );
}
