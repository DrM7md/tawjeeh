import { PageHeader } from '@/components/shared/page-header';
import { BarCard, ChartCard, GaugeCard, PALETTE, PieCard, type Datum } from '@/components/shared/stat-charts';
import { StatCard } from '@/components/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Building2, ClipboardCheck, UserCog, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'المستخدمون', href: '/users' },
    { title: 'الإحصائيات', href: '/users-statistics' },
];

interface Performer {
    name: string;
    department: string;
    schools: number;
    visits: number;
    reviews: number;
}
interface Stats {
    kpis: { total: number; active: number; inactive: number; supervisors: number; departmentHeads: number; unassigned: number; avgVisits: number; avgSchools: number };
    byDepartment: Datum[];
    byRole: Datum[];
    activeStatus: Datum[];
    performance: Performer[];
    topPerformers: Performer[];
}

export default function UsersStatistics({ stats }: { stats: Stats }) {
    const k = stats.kpis;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="إحصائيات المستخدمين" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="إحصائيات المستخدمين" description="تحليل المستخدمين والأدوار وأداء الموجهين" backHref="/users" />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="إجمالي المستخدمين" value={k.total} icon={Users} tone="primary" hint={`${k.active} نشط · ${k.inactive} معطّل`} />
                    <StatCard title="الموجهون" value={k.supervisors} icon={UserCog} tone="info" hint={`متوسط ${k.avgSchools} مدرسة لكل موجّه`} />
                    <StatCard title="رؤساء الأقسام" value={k.departmentHeads} icon={Building2} tone="warning" />
                    <StatCard title="متوسط زيارات الموجّه" value={k.avgVisits} icon={ClipboardCheck} tone="success" />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <GaugeCard
                        title="مؤشرات عامة"
                        hint="نسبة النشطين ونصيب الموجهين"
                        items={[
                            { pct: k.total ? (k.active / k.total) * 100 : 0, color: '#22C55E', label: 'المستخدمون النشطون', sub: `${k.active}/${k.total}` },
                            { pct: k.total ? (k.supervisors / k.total) * 100 : 0, color: PALETTE[1], label: 'نسبة الموجهين', sub: `${k.supervisors}/${k.total}` },
                        ]}
                    />
                    <PieCard title="المستخدمون حسب الدور" hint="توزيع الأدوار النظامية" data={stats.byRole} centerLabel="مستخدم" />
                    <BarCard title="المستخدمون حسب القسم" hint="عدد المستخدمين في كل قسم" data={stats.byDepartment} horizontal color={PALETTE[0]} />
                </div>

                {/* مقارنة أداء الموجهين */}
                <ChartCard title="مقارنة أداء الموجهين" hint="الزيارات والتحكيمات والمدارس المسندة لكل موجّه">
                    {stats.topPerformers.length === 0 ? (
                        <div className="text-muted-foreground flex h-[320px] items-center justify-center text-sm">لا يوجد موجهون</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={Math.max(320, stats.topPerformers.length * 52)}>
                            <BarChart data={stats.topPerformers} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap="22%">
                                <defs>
                                    <linearGradient id="perf-visits" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#C97A92" />
                                        <stop offset="100%" stopColor={PALETTE[0]} />
                                    </linearGradient>
                                    <linearGradient id="perf-reviews" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#FFD27A" />
                                        <stop offset="100%" stopColor={PALETTE[2]} />
                                    </linearGradient>
                                    <linearGradient id="perf-schools" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#A9CBF5" />
                                        <stop offset="100%" stopColor={PALETTE[1]} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} interval={0} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid var(--border)' }} cursor={{ fill: 'currentColor', className: 'text-muted/40' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                <Bar dataKey="visits" name="الزيارات" fill="url(#perf-visits)" radius={[0, 6, 6, 0]} maxBarSize={16} animationDuration={900} />
                                <Bar dataKey="reviews" name="التحكيمات" fill="url(#perf-reviews)" radius={[0, 6, 6, 0]} maxBarSize={16} animationDuration={900} />
                                <Bar dataKey="schools" name="المدارس" fill="url(#perf-schools)" radius={[0, 6, 6, 0]} maxBarSize={16} animationDuration={900} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                {/* جدول لوحة الصدارة */}
                <ChartCard title="لوحة صدارة الموجهين" hint="مرتّبة حسب عدد الزيارات المنجزة">
                    {stats.performance.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">لا يوجد موجهون</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead>الموجّه</TableHead>
                                    <TableHead>القسم</TableHead>
                                    <TableHead className="text-center">المدارس</TableHead>
                                    <TableHead className="text-center">الزيارات</TableHead>
                                    <TableHead className="text-center">التحكيمات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.performance.map((p, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-muted-foreground tnum text-center">{i + 1}</TableCell>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{p.department}</TableCell>
                                        <TableCell className="tnum text-center">{p.schools}</TableCell>
                                        <TableCell className="tnum text-center font-semibold">{p.visits}</TableCell>
                                        <TableCell className="tnum text-center">{p.reviews}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </ChartCard>
            </div>
        </AppLayout>
    );
}
