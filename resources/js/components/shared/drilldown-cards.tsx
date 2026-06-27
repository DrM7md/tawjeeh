import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Building2, CheckCircle2, ChevronLeft, ClipboardList, Clock, UserRound, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * مكوّنات التنقّل الهرمي المشتركة (الأقسام ← الموجهون ← المحتوى).
 * مستخرجة من شاشة الزيارات لإعادة استخدامها في التصنيف/الملفات/التوزيع وغيرها.
 */

export interface Stats {
    total: number;
    done: number;
    remaining: number;
    late: number;
    completion: number;
}

/** نوع الموجّه لوسمه بنقطة لونية في البطاقة. */
export type SupervisorGender = 'male' | 'female' | null;

export function completionTone(pct: number): { bar: string; text: string } {
    if (pct >= 80) return { bar: 'bg-success', text: 'text-success' };
    if (pct >= 50) return { bar: 'bg-warning', text: 'text-warning' };
    return { bar: 'bg-destructive', text: 'text-destructive' };
}

/** تجميع إحصاءات عدّة بطاقات في إجمالي واحد. */
export function aggregate(items: Stats[]): Stats {
    const sum = (k: keyof Stats) => items.reduce((a, b) => a + b[k], 0);
    const total = sum('total');
    const done = sum('done');
    return {
        total,
        done,
        remaining: sum('remaining'),
        late: sum('late'),
        completion: total ? Math.round((done / total) * 1000) / 10 : 0,
    };
}

/**
 * بطاقة قسم/موجّه قابلة للنقر للدخول.
 * - مع `stats`: تعرض نسبة الإنجاز + شريط تقدّم + تفصيل الحالة (الافتراضي).
 * - مع `metric` بدلًا من `stats`: تعرض مؤشّرًا واحدًا فقط (مثل عدد المنسقين) دون نسبة إنجاز.
 */
export function BoardCard({
    href,
    name,
    icon: Icon,
    subtitle,
    stats,
    metric,
    gender = null,
}: Readonly<{
    href: string;
    name: string;
    icon: LucideIcon;
    subtitle?: string;
    stats?: Stats;
    metric?: { label: string; value: number | string };
    gender?: SupervisorGender;
}>) {
    const tone = stats ? completionTone(stats.completion) : null;

    return (
        <Link href={href} className="group">
            <Card className="hover-lift group-hover:border-primary/50 flex h-full flex-col gap-4 p-5 transition-colors">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                            <Icon className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="truncate font-semibold">{name}</p>
                                {gender === 'male' && <span className="size-2 shrink-0 rounded-full bg-sky-500" title="موجِّه" />}
                                {gender === 'female' && <span className="size-2 shrink-0 rounded-full bg-pink-500" title="موجِّهة" />}
                            </div>
                            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
                        </div>
                    </div>
                    <ChevronLeft className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                </div>

                {stats && tone && (
                    <>
                        <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between">
                                <span className="text-muted-foreground text-xs">نسبة الإنجاز</span>
                                <span className={cn('tnum text-lg font-bold', tone.text)}>{stats.completion}%</span>
                            </div>
                            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                                <div className={cn('h-full rounded-full transition-all', tone.bar)} style={{ width: `${stats.completion}%` }} />
                            </div>
                        </div>

                        <dl className="text-muted-foreground border-border/60 grid grid-cols-4 gap-2 border-t pt-3 text-center text-xs">
                            <div>
                                <dt>الكل</dt>
                                <dd className="text-foreground tnum font-semibold">{stats.total}</dd>
                            </div>
                            <div>
                                <dt className="text-success">تمت</dt>
                                <dd className="text-foreground tnum font-semibold">{stats.done}</dd>
                            </div>
                            <div>
                                <dt className="text-warning">متبقٍ</dt>
                                <dd className="text-foreground tnum font-semibold">{stats.remaining}</dd>
                            </div>
                            <div>
                                <dt className="text-destructive">متأخر</dt>
                                <dd className="text-foreground tnum font-semibold">{stats.late}</dd>
                            </div>
                        </dl>
                    </>
                )}

                {!stats && metric && (
                    <div className="border-border/60 mt-auto flex items-baseline justify-between border-t pt-3">
                        <span className="text-muted-foreground text-xs">{metric.label}</span>
                        <span className="text-primary tnum text-2xl font-bold">{metric.value}</span>
                    </div>
                )}
            </Card>
        </Link>
    );
}

export type GenderTab = 'all' | 'boys' | 'girls';

/** تبويب بنين/بنات/الكل لتصفية بطاقات الموجهين حسب النوع. */
export function GenderTabs({ value, onChange }: Readonly<{ value: GenderTab; onChange: (v: GenderTab) => void }>) {
    return (
        <Tabs value={value} onValueChange={(v) => onChange(v as GenderTab)}>
            <TabsList>
                <TabsTrigger value="all">الكل</TabsTrigger>
                <TabsTrigger value="boys">بنين</TabsTrigger>
                <TabsTrigger value="girls">بنات</TabsTrigger>
            </TabsList>
        </Tabs>
    );
}

/** الموجّه يظهر في التبويب المختار حسب نوعه (غير المحدّد يظهر دائمًا). */
export function supervisorInGenderTab(gender: SupervisorGender, tab: GenderTab): boolean {
    if (tab === 'all' || !gender) return true;
    return tab === 'boys' ? gender === 'male' : gender === 'female';
}

/** زر رجوع لمستوى أعلى في التنقّل الهرمي. */
export function DrilldownBack({ href, label }: Readonly<{ href: string; label: string }>) {
    return (
        <Link
            href={href}
            className="text-muted-foreground hover:text-primary -mb-2 inline-flex w-fit items-center gap-1 text-sm font-medium transition-colors"
        >
            <ChevronLeft className="size-4 rotate-180" /> {label}
        </Link>
    );
}

export interface DeptBoardItem extends Stats {
    id: number;
    name: string;
}
export interface SupBoardItem extends Stats {
    id: number;
    name: string;
    gender: SupervisorGender;
    schools?: number;
}

/** صف إحصاءات علوي مجمّع لبطاقات الأقسام/الموجهين. */
function StatRow({ items, unit }: Readonly<{ items: Stats[]; unit: string }>) {
    const t = aggregate(items);
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="نسبة الإنجاز الكلية" value={`${t.completion}%`} icon={ClipboardList} tone="primary" hint={`${t.total} ${unit}`} />
            <StatCard title="منجز" value={t.done} icon={CheckCircle2} tone="success" />
            <StatCard title="متبقٍّ" value={t.remaining} icon={Clock} tone="warning" />
            <StatCard title="متأخر" value={t.late} icon={AlertTriangle} tone="destructive" />
        </div>
    );
}

/**
 * مستوى بطاقات الأقسام الجاهز (رئيس التوجيه): شريط إحصاءات + بطاقات قابلة للنقر.
 * يبني الروابط من `base` (مثال: `/coordinators?department=ID`).
 */
export function DepartmentsLevel({
    base,
    crumbLabel,
    title,
    description,
    unit,
    departments,
}: Readonly<{ base: string; crumbLabel: string; title: string; description: string; unit: string; departments: DeptBoardItem[] }>) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: crumbLabel, href: base },
    ];
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${crumbLabel} — الأقسام`} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title={title} description={description} />
                <StatRow items={departments} unit={unit} />
                {departments.length === 0 ? (
                    <Card className="text-muted-foreground p-8 text-center">لا توجد أقسام</Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {departments.map((d) => (
                            <BoardCard key={d.id} href={`${base}?department=${d.id}`} name={d.name} icon={Building2} stats={d} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

/**
 * مستوى بطاقات الموجهين الجاهز: شريط إحصاءات + تبويب بنين/بنات (ظاهر دائمًا) + بطاقات.
 * يبني الروابط من `base` (مثال: `/coordinators?supervisor=ID`).
 */
export function SupervisorsLevel({
    base,
    crumbLabel,
    department,
    description,
    unit,
    supervisors,
    canDrillDepartments,
}: Readonly<{
    base: string;
    crumbLabel: string;
    department: { id: number; name: string } | null;
    description: string;
    unit: string;
    supervisors: SupBoardItem[];
    canDrillDepartments?: boolean;
}>) {
    const [genderTab, setGenderTab] = useState<GenderTab>('all');
    const visible = supervisors.filter((s) => supervisorInGenderTab(s.gender, genderTab));
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: crumbLabel, href: base },
        { title: department?.name ?? 'القسم', href: '#' },
    ];
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${crumbLabel} — ${department?.name ?? 'الموجهون'}`} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                {canDrillDepartments && <DrilldownBack href={base} label="رجوع إلى الأقسام" />}
                <PageHeader title={department?.name ?? 'الموجهون'} description={description} />
                <StatRow items={supervisors} unit={unit} />
                <GenderTabs value={genderTab} onChange={setGenderTab} />
                {visible.length === 0 ? (
                    <Card className="text-muted-foreground p-8 text-center">
                        {supervisors.length === 0 ? 'لا يوجد موجّهون في هذا القسم' : 'لا يوجد موجّهون مطابقون لهذا التبويب'}
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {visible.map((s) => (
                            <BoardCard
                                key={s.id}
                                href={`${base}?supervisor=${s.id}`}
                                name={s.name}
                                icon={UserRound}
                                gender={s.gender}
                                subtitle={s.schools != null ? `${s.schools} مدرسة` : undefined}
                                stats={s}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
