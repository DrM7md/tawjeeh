import { StatCard } from '@/components/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Award, Building2, CheckCircle2, ClipboardCheck, GraduationCap, Network, School, Users } from 'lucide-react';
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
interface Dashboard {
    scope: 'global' | 'department' | 'supervisor';
    department?: string;
    cards: Cards;
    departmentPerformance?: { department: string; completion: number; done: number; remaining: number; reviews: number }[];
    supervisorComparison?: { supervisor: string; visits: number; schools: number }[];
    statusDistribution: { name: string; value: number }[];
}

const PIE_COLORS = ['#34C759', '#FF9F0A', '#FF3B30'];
const PRIMARY = '#8D1B3D';
const INFO = '#3B82F6';

export default function Dashboard({ dashboard }: { dashboard: Dashboard }) {
    const c = dashboard.cards;
    const hasStatus = dashboard.statusDistribution.some((s) => s.value > 0);

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
                    <StatCard title="نسبة الإنجاز" value={`${c.completion ?? 0}%`} icon={CheckCircle2} tone={(c.completion ?? 0) >= 80 ? 'success' : (c.completion ?? 0) >= 50 ? 'warning' : 'destructive'} />
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

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* أداء الأقسام */}
                    {dashboard.departmentPerformance && dashboard.departmentPerformance.length > 0 && (
                        <ChartCard title="نسبة إنجاز الأقسام">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={dashboard.departmentPerformance} layout="vertical" margin={{ right: 16 }}>
                                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="department" width={110} tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v: number) => `${v}%`} />
                                    <Bar dataKey="completion" fill={PRIMARY} radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    )}

                    {/* مقارنة الموجهين */}
                    {dashboard.supervisorComparison && dashboard.supervisorComparison.length > 0 && (
                        <ChartCard title="مقارنة الموجهين (الزيارات)">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={dashboard.supervisorComparison} margin={{ top: 8 }}>
                                    <XAxis dataKey="supervisor" tick={{ fontSize: 11 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="visits" name="زيارات" fill={PRIMARY} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="schools" name="مدارس" fill={INFO} radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    )}

                    {/* توزيع حالات الإنجاز */}
                    {hasStatus && (
                        <ChartCard title="توزيع حالات الزيارات">
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={dashboard.statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                                        {dashboard.statusDistribution.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card rounded-2xl border border-border/60 p-5">
            <h2 className="mb-4 text-lg font-semibold">{title}</h2>
            {children}
        </div>
    );
}
