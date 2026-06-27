import { PageHeader } from '@/components/shared/page-header';
import { BarCard, ChartCard, GaugeCard, PALETTE, PieCard, type Datum } from '@/components/shared/stat-charts';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { GraduationCap, MapPin, School, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'المدارس', href: '/schools' },
    { title: 'الإحصائيات', href: '/schools-statistics' },
];

interface TopSchool {
    name: string;
    stage: string;
    gender: string;
    teachers: number;
    coordinators: number;
    visits: number;
    assigned: boolean;
}
interface Stats {
    kpis: { total: number; active: number; inactive: number; teachers: number; coordinators: number; avgTeachers: number; assigned: number; unassigned: number };
    byStage: { name: string; schools: number; teachers: number }[];
    byGender: Datum[];
    byZone: Datum[];
    coverage: Datum[];
    teacherGender: Datum[];
    teacherClassification: Datum[];
    teacherNationality: Datum[];
    topSchools: TopSchool[];
}

export default function SchoolsStatistics({ stats }: { stats: Stats }) {
    const k = stats.kpis;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="إحصائيات المدارس" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="إحصائيات المدارس" description="نظرة تحليلية شاملة على المدارس والمعلمين والتغطية الإشرافية" backHref="/schools" />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="إجمالي المدارس" value={k.total} icon={School} tone="primary" hint={`${k.active} نشطة · ${k.inactive} معطّلة`} />
                    <StatCard title="إجمالي المعلمين" value={k.teachers} icon={GraduationCap} tone="info" hint={`متوسط ${k.avgTeachers} لكل مدرسة`} />
                    <StatCard title="المنسقون" value={k.coordinators} icon={Users} tone="warning" />
                    <StatCard title="التغطية الإشرافية" value={`${k.total ? Math.round((k.assigned / k.total) * 100) : 0}%`} icon={ShieldCheck} tone={k.unassigned === 0 ? 'success' : 'destructive'} hint={`${k.assigned} مُغطّاة · ${k.unassigned} بدون`} />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* المدارس والمعلمون حسب المرحلة (أعمدة مزدوجة) */}
                    <ChartCard title="التوزيع حسب المرحلة" hint="عدد المدارس والمعلمين في كل مرحلة">
                        {stats.byStage.length === 0 ? (
                            <div className="text-muted-foreground flex h-[300px] items-center justify-center text-sm">لا توجد بيانات</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={stats.byStage} margin={{ top: 8 }}>
                                    <defs>
                                        <linearGradient id="stg-schools" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={PALETTE[0]} />
                                            <stop offset="100%" stopColor="#C97A92" />
                                        </linearGradient>
                                        <linearGradient id="stg-teachers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={PALETTE[1]} />
                                            <stop offset="100%" stopColor="#A9CBF5" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid var(--border)' }} cursor={{ fill: 'currentColor', className: 'text-muted/40' }} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                                    <Bar dataKey="schools" name="المدارس" fill="url(#stg-schools)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={900} />
                                    <Bar dataKey="teachers" name="المعلمون" fill="url(#stg-teachers)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={900} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    <GaugeCard
                        title="مؤشرات التغطية"
                        hint="نسبة المدارس المُسندة لموجّهين ونسبة النشاط"
                        items={[
                            { pct: k.total ? (k.assigned / k.total) * 100 : 0, color: PALETTE[0], label: 'التغطية الإشرافية', sub: `${k.assigned}/${k.total}` },
                            { pct: k.total ? (k.active / k.total) * 100 : 0, color: PALETTE[4], label: 'المدارس النشطة', sub: `${k.active}/${k.total}` },
                        ]}
                    />

                    <PieCard title="المدارس حسب النوع" hint="بنين / بنات / مشترك" data={stats.byGender} centerLabel="مدرسة" />

                    <BarCard title="المدارس حسب المنطقة" hint="أعلى المناطق من حيث عدد المدارس" data={stats.byZone} horizontal color={PALETTE[3]} />

                    <PieCard title="المعلمون حسب الجنس" data={stats.teacherGender} colors={[PALETTE[1], '#EC4899']} centerLabel="معلم" />

                    <BarCard title="المعلمون حسب التصنيف" hint="توزيع المعلمين على تصنيفات الزيارة" data={stats.teacherClassification} horizontal color={PALETTE[2]} />

                    {stats.teacherNationality.length > 0 && (
                        <BarCard title="المعلمون حسب الجنسية" data={stats.teacherNationality} horizontal color={PALETTE[4]} className="lg:col-span-2" />
                    )}
                </div>

                {/* جدول أكبر المدارس */}
                <ChartCard title="أكبر المدارس" hint="مرتّبة حسب عدد المعلمين">
                    {stats.topSchools.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">لا توجد بيانات</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>المدرسة</TableHead>
                                    <TableHead>المرحلة</TableHead>
                                    <TableHead>النوع</TableHead>
                                    <TableHead className="text-center">المعلمون</TableHead>
                                    <TableHead className="text-center">المنسقون</TableHead>
                                    <TableHead className="text-center">الزيارات</TableHead>
                                    <TableHead className="text-center">التغطية</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.topSchools.map((s, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{s.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{s.stage}</TableCell>
                                        <TableCell className="text-muted-foreground">{s.gender}</TableCell>
                                        <TableCell className="tnum text-center">{s.teachers}</TableCell>
                                        <TableCell className="tnum text-center">{s.coordinators}</TableCell>
                                        <TableCell className="tnum text-center">{s.visits}</TableCell>
                                        <TableCell className="text-center">
                                            {s.assigned ? (
                                                <Badge className="gap-1"><UserCheck className="size-3" /> مُغطّاة</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="gap-1"><MapPin className="size-3" /> بدون</Badge>
                                            )}
                                        </TableCell>
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
