import { PageHeader } from '@/components/shared/page-header';
import { BarCard, ChartCard, GaugeCard, PALETTE, PieCard } from '@/components/shared/stat-charts';
import { StatCard } from '@/components/stat-card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Award, Building2, CheckCircle2, ClipboardCheck, GraduationCap, Network, School, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'لوحة التحكم', href: '/dashboard' }];

interface SupervisorRow {
    supervisor: string;
    schools: number;
    visits_pct: number;
    visits_done: number;
    visits_total: number;
    reviews_pct: number;
    reviews_done: number;
    reviews_total: number;
    overall: number;
}

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
interface Dashboard {
    scope: 'global' | 'department' | 'supervisor';
    department?: string;
    cards: Cards;
    departmentPerformance?: { department: string; completion: number; done: number; remaining: number; reviews: number }[];
    supervisorComparison?: SupervisorRow[];
    statusDistribution: { name: string; value: number }[];
}

const STATUS_COLORS = ['#22C55E', '#FF9F0A', '#FF3B30'];

function SupervisorTooltip({ active, payload }: { active?: boolean; payload?: { payload: SupervisorRow }[] }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const overallColor = d.overall >= 80 ? '#22C55E' : d.overall >= 50 ? '#FF9F0A' : '#FF3B30';
    return (
        <div className="border-border bg-background rounded-xl border p-3 text-xs shadow-md">
            <div className="mb-1.5 font-semibold">{d.supervisor}</div>
            <div className="text-muted-foreground mb-1">المدارس المسندة: {d.schools}</div>
            <div style={{ color: PALETTE[0] }}>
                الزيارات: {d.visits_pct}% ({d.visits_done}/{d.visits_total})
            </div>
            <div style={{ color: PALETTE[1] }}>
                التحكيم: {d.reviews_pct}% ({d.reviews_done}/{d.reviews_total})
            </div>
            <div className="mt-1.5 font-medium" style={{ color: overallColor }}>
                الإجمالي: {d.overall}%
            </div>
        </div>
    );
}

export default function Dashboard({ dashboard }: { dashboard: Dashboard }) {
    const c = dashboard.cards;
    const completion = c.completion ?? 0;
    const completionColor = completion >= 80 ? '#22C55E' : completion >= 50 ? '#FF9F0A' : '#FF3B30';
    const hasStatus = dashboard.statusDistribution.some((s) => s.value > 0);

    const deptData = (dashboard.departmentPerformance ?? []).map((d) => ({ name: d.department, value: d.completion }));

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

                {/* أداء الأقسام (للنطاق العام) */}
                {deptData.length > 0 && (
                    <BarCard title="نسبة إنجاز الأقسام" hint="نسبة الزيارات المنجزة لكل قسم" data={deptData} horizontal color={PALETTE[0]} unit="%" height={Math.max(260, deptData.length * 46)} />
                )}

                {/* متابعة الموجهين: نسبة إنجاز الزيارات والتحكيم، مرتّبة من الأكثر تقدّمًا */}
                {dashboard.supervisorComparison && dashboard.supervisorComparison.length > 0 && (
                    <ChartCard
                        title="متابعة الموجّهين"
                        hint="نسبة إنجاز الزيارات والتحكيم لكل موجّه — مرتّبون من الأكثر تقدّمًا إلى الأكثر تعثّرًا"
                        accent={PALETTE[1]}
                    >
                        <ResponsiveContainer width="100%" height={Math.max(300, dashboard.supervisorComparison.length * 56)}>
                            <BarChart data={dashboard.supervisorComparison} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap="24%">
                                <defs>
                                    <linearGradient id="sup-visits" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#C97A92" />
                                        <stop offset="100%" stopColor={PALETTE[0]} />
                                    </linearGradient>
                                    <linearGradient id="sup-reviews" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#A9CBF5" />
                                        <stop offset="100%" stopColor={PALETTE[1]} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="supervisor" width={120} tick={{ fontSize: 11 }} interval={0} axisLine={false} tickLine={false} />
                                <Tooltip content={<SupervisorTooltip />} cursor={{ fill: 'currentColor', className: 'text-muted/40' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                <Bar dataKey="visits_pct" name="الزيارات" fill="url(#sup-visits)" radius={[0, 6, 6, 0]} maxBarSize={18} animationDuration={900} />
                                <Bar dataKey="reviews_pct" name="التحكيم" fill="url(#sup-reviews)" radius={[0, 6, 6, 0]} maxBarSize={18} animationDuration={900} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>
        </AppLayout>
    );
}
