import { PageHeader } from '@/components/shared/page-header';
import { BarCard, ChartCard, GaugeCard, PALETTE, PieCard } from '@/components/shared/stat-charts';
import { StatCard } from '@/components/stat-card';
import { examPeriodLabel } from '@/lib/exam-periods';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Award,
    Building2,
    CalendarClock,
    CheckCircle2,
    ClipboardCheck,
    ClipboardX,
    GraduationCap,
    MapPin,
    Network,
    School,
    TrendingDown,
    Users,
} from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'لوحة التحكم', href: '/dashboard' }];

interface Cards {
    departments?: number;
    schools?: number;
    supervisors?: number;
    teachers?: number;
    coordinators?: number;
    completion?: number;
    visits_done?: number;
    reviews?: number;
    incomplete?: number;
    remaining?: number;
}

interface Attention {
    late_visits: number;
    reviews_pending: number;
    schools_no_visits: number;
    lagging_supervisors: { name: string; overall: number; schools: number }[];
    schools_without_visits: string[];
}

interface ReviewsSummary {
    completion: number;
    done: number;
    total: number;
    periods: { period: string; done: number; total: number }[];
}

interface UpcomingTask {
    id: number;
    title: string;
    priority: 'normal' | 'medium' | 'urgent' | 'critical';
    color: string | null;
    location: string | null;
    start_date: string | null;
    due_date: string | null;
    event_type: { name: string; color: string | null } | null;
    done_count: number;
    total_count: number;
}

interface Dashboard {
    scope: 'global' | 'department' | 'supervisor';
    department?: string;
    cards: Cards;
    departmentPerformance?: { department: string; completion: number; done: number; remaining: number; reviews: number }[];
    statusDistribution: { name: string; value: number }[];
    attention?: Attention;
    trend?: { name: string; done: number | null; target: number }[];
    reviewsSummary?: ReviewsSummary;
    upcomingTasks?: UpcomingTask[];
}

const STATUS_COLORS = ['#22C55E', '#FF9F0A', '#FF3B30'];

const PRIORITY_COLOR: Record<UpcomingTask['priority'], string> = {
    critical: '#dc2626',
    urgent: '#ea580c',
    medium: '#d97706',
    normal: '#2563eb',
};

/* ===================== «تحتاج انتباهك» ===================== */
function AttentionCard({ data }: { data: Attention }) {
    const chips = [
        { label: 'زيارات متأخرة', value: data.late_visits, icon: ClipboardX, color: '#FF3B30' },
        { label: 'تحكيمات متبقية', value: data.reviews_pending, icon: Award, color: '#FF9F0A' },
        { label: 'مدارس بلا زيارة', value: data.schools_no_visits, icon: School, color: '#8D1B3D' },
    ];
    const clear = data.late_visits === 0 && data.reviews_pending === 0 && data.schools_no_visits === 0;

    return (
        <div className="bg-card relative flex flex-col overflow-hidden rounded-2xl border border-border/60 p-5 shadow-sm">
            <span className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ background: 'linear-gradient(90deg, #FF3B30, #FF9F0A)' }} />
            <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                <div>
                    <h2 className="text-base font-semibold">تحتاج انتباهك</h2>
                    <p className="text-muted-foreground text-xs">أبرز ما يحتاج تدخّلاً سريعاً</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {chips.map((c) => (
                    <div key={c.label} className="bg-muted/40 flex flex-col items-center gap-1 rounded-xl border border-border/50 p-3 text-center">
                        <c.icon className="size-5" style={{ color: c.color }} />
                        <span className="tnum text-2xl font-bold" style={{ color: c.color }}>
                            {c.value}
                        </span>
                        <span className="text-muted-foreground text-[11px] leading-tight">{c.label}</span>
                    </div>
                ))}
            </div>

            {clear ? (
                <div className="text-muted-foreground mt-4 flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/5 py-4 text-sm">
                    <CheckCircle2 className="size-4 text-success" />
                    كل المؤشرات ضمن المسار — لا يوجد ما يستدعي التدخّل حالياً.
                </div>
            ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {data.lagging_supervisors.length > 0 && (
                        <div>
                            <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                                <TrendingDown className="size-3.5" /> الموجّهون الأكثر تعثّراً
                            </h3>
                            <ul className="space-y-1.5">
                                {data.lagging_supervisors.map((s) => (
                                    <li key={s.name} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="truncate">{s.name}</span>
                                        <span
                                            className="tnum shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold"
                                            style={{
                                                color: s.overall >= 50 ? '#FF9F0A' : '#FF3B30',
                                                background: s.overall >= 50 ? 'rgba(255,159,10,.12)' : 'rgba(255,59,48,.12)',
                                            }}
                                        >
                                            {s.overall}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {data.schools_without_visits.length > 0 && (
                        <div>
                            <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                                <School className="size-3.5" /> مدارس دون أي زيارة
                            </h3>
                            <ul className="space-y-1.5">
                                {data.schools_without_visits.map((name) => (
                                    <li key={name} className="text-foreground/90 flex items-center gap-1.5 truncate text-sm">
                                        <span className="bg-destructive/60 size-1.5 shrink-0 rounded-full" />
                                        {name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ===================== منحنى الإنجاز الزمني ===================== */
function CompletionTrendCard({ data }: { data: NonNullable<Dashboard['trend']> }) {
    return (
        <ChartCard
            title="منحنى الإنجاز الزمني"
            hint="الزيارات المنجزة التراكمية مقابل المسار المثالي عبر أسابيع الفصل"
            accent={PALETTE[0]}
            className="lg:col-span-2"
        >
            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data} margin={{ top: 12, right: 12 }}>
                    <defs>
                        <linearGradient id="trend-done" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} axisLine={false} tickLine={false} />
                    <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid var(--border)', background: 'var(--popover)' }}
                        labelStyle={{ fontWeight: 700 }}
                    />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Area
                        type="monotone"
                        dataKey="done"
                        name="المنجز"
                        connectNulls
                        stroke={PALETTE[0]}
                        strokeWidth={2.5}
                        fill="url(#trend-done)"
                        dot={{ r: 3, fill: PALETTE[0], strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--card)' }}
                        animationDuration={1000}
                    />
                    <Line type="monotone" dataKey="target" name="المسار المثالي" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} animationDuration={1000} />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}

/* ===================== ملخّص التحكيم المفصّل ===================== */
function ReviewsSummaryCard({ data }: { data: ReviewsSummary }) {
    const color = PALETTE[2];
    return (
        <ChartCard title="متابعة التحكيم" hint={`${data.done} من ${data.total} اختباراً مُحكّماً`} accent={color}>
            <div className="mb-4 flex items-baseline gap-2">
                <span className="tnum text-3xl font-bold" style={{ color }}>
                    {data.completion}%
                </span>
                <span className="text-muted-foreground text-xs">نسبة التحكيم الكلية</span>
            </div>
            <div className="space-y-3">
                {data.periods.map((p) => {
                    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
                    return (
                        <div key={p.period}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="text-foreground/80">{examPeriodLabel(p.period)}</span>
                                <span className="tnum text-muted-foreground">
                                    {p.done}/{p.total}
                                </span>
                            </div>
                            <div className="bg-muted h-2 overflow-hidden rounded-full">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </ChartCard>
    );
}

/* ===================== مهام التقويم القادمة ===================== */
function UpcomingTasksCard({ tasks }: { tasks: UpcomingTask[] }) {
    const fmt = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('ar', { weekday: 'short', day: 'numeric', month: 'short' }) : '';

    return (
        <ChartCard
            title="مهام التقويم القادمة"
            hint="خلال الأسبوعين القادمين"
            accent={PALETTE[3]}
            actions={
                <Link href="/calendar" className="text-primary text-xs font-medium hover:underline">
                    التقويم ←
                </Link>
            }
        >
            {tasks.length === 0 ? (
                <div className="text-muted-foreground/70 flex flex-col items-center justify-center gap-2 py-10 text-sm">
                    <CalendarClock className="size-8 opacity-40" />
                    لا توجد مهام قادمة
                </div>
            ) : (
                <ul className="space-y-2">
                    {tasks.map((t) => {
                        const dot = t.color || t.event_type?.color || PRIORITY_COLOR[t.priority];
                        return (
                            <li key={t.id} className="bg-muted/30 hover:bg-muted/60 flex items-center gap-3 rounded-xl border border-border/40 p-3 transition-colors">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: dot }} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{t.title}</p>
                                    <p className="text-muted-foreground flex items-center gap-2 text-[11px]">
                                        <span className="flex items-center gap-1">
                                            <CalendarClock className="size-3" />
                                            {fmt(t.start_date)}
                                        </span>
                                        {t.location && (
                                            <span className="flex items-center gap-1 truncate">
                                                <MapPin className="size-3" />
                                                {t.location}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                {t.total_count > 0 && (
                                    <span className="tnum text-muted-foreground bg-background shrink-0 rounded-md border border-border/50 px-1.5 py-0.5 text-[11px]">
                                        {t.done_count}/{t.total_count}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </ChartCard>
    );
}

export default function Dashboard({ dashboard }: { dashboard: Dashboard }) {
    const c = dashboard.cards;
    const completion = c.completion ?? 0;
    const completionColor = completion >= 80 ? '#22C55E' : completion >= 50 ? '#FF9F0A' : '#FF3B30';
    const hasStatus = dashboard.statusDistribution.some((s) => s.value > 0);

    const deptData = (dashboard.departmentPerformance ?? []).map((d) => ({ name: d.department, value: d.completion }));
    const hasTrend = (dashboard.trend ?? []).length > 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="لوحة التحكم" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="لوحة التحكم"
                    description={
                        dashboard.scope === 'global'
                            ? 'المؤشرات العامة لإدارة التوجيه'
                            : dashboard.scope === 'department'
                              ? `مؤشرات قسم ${dashboard.department ?? ''}`
                              : 'ملخّص أعمالك الإشرافية'
                    }
                />

                {/* البطاقات الإحصائية */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="نسبة الإنجاز" value={`${completion}%`} icon={CheckCircle2} tone={completion >= 80 ? 'success' : completion >= 50 ? 'warning' : 'destructive'} />
                    {dashboard.scope === 'global' && <StatCard title="الأقسام" value={c.departments ?? 0} icon={Building2} tone="primary" />}
                    <StatCard title="المدارس" value={c.schools ?? 0} icon={School} tone="info" />
                    {c.supervisors !== undefined && <StatCard title="الموجهون" value={c.supervisors} icon={Users} tone="primary" />}
                    {c.teachers !== undefined && <StatCard title="المعلمون" value={c.teachers} icon={GraduationCap} tone="info" />}
                    <StatCard title="الزيارات المنجزة" value={c.visits_done ?? 0} icon={ClipboardCheck} tone="success" />
                    <StatCard title="التحكيمات" value={c.reviews ?? 0} icon={Award} tone="warning" />
                    {(c.incomplete ?? c.remaining) !== undefined && (
                        <StatCard title="غير المنجز" value={c.incomplete ?? c.remaining ?? 0} icon={Network} tone="destructive" />
                    )}
                </div>

                {/* تحتاج انتباهك */}
                {dashboard.attention && <AttentionCard data={dashboard.attention} />}

                {/* عدّاد الإنجاز + توزيع الحالات */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <GaugeCard
                        title="نسبة الإنجاز العامة"
                        hint="نسبة الزيارات المنجزة من إجمالي المستهدف"
                        items={[{ pct: completion, color: completionColor, label: 'الإنجاز', sub: `${c.visits_done ?? 0} زيارة` }]}
                    />

                    {hasStatus ? (
                        <PieCard title="توزيع حالات الزيارات" hint="تمت / متبقٍ / متأخر" data={dashboard.statusDistribution} colors={STATUS_COLORS} centerLabel="مستهدف" />
                    ) : (
                        <ChartCard title="توزيع حالات الزيارات">
                            <div className="text-muted-foreground flex h-[300px] items-center justify-center text-sm">لا توجد بيانات بعد</div>
                        </ChartCard>
                    )}
                </div>

                {/* منحنى الإنجاز الزمني */}
                {hasTrend && <CompletionTrendCard data={dashboard.trend!} />}

                {/* أداء الأقسام (للنطاق العام) — أعمدة رأسية */}
                {deptData.length > 0 && (
                    <BarCard title="نسبة إنجاز الأقسام" hint="نسبة الزيارات المنجزة لكل قسم" data={deptData} color={PALETTE[0]} unit="%" height={320} />
                )}

                {/* متابعة التحكيم + مهام التقويم */}
                {(dashboard.reviewsSummary || dashboard.upcomingTasks) && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {dashboard.reviewsSummary && <ReviewsSummaryCard data={dashboard.reviewsSummary} />}
                        {dashboard.upcomingTasks && <UpcomingTasksCard tasks={dashboard.upcomingTasks} />}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
