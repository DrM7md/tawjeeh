import { PageHeader } from '@/components/shared/page-header';
import { BarCard, GaugeCard, PALETTE, PieCard, TrendCard, type Datum } from '@/components/shared/stat-charts';
import { StatCard } from '@/components/stat-card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CheckCircle2, ClipboardCheck, School, UserCog } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الزيارات', href: '/visits' },
    { title: 'الإحصائيات', href: '/visits-statistics' },
];

interface Stats {
    kpis: { total: number; teacher: number; coordinator: number; schools: number; supervisors: number; finalized: number; draft: number };
    byMonth: Datum[];
    byType: Datum[];
    byDepartment: Datum[];
    bySupervisor: Datum[];
    bySchool: Datum[];
    formStatus: Datum[];
}

export default function VisitsStatistics({ stats }: { stats: Stats }) {
    const k = stats.kpis;
    const finalizedPct = k.total ? Math.round((k.finalized / k.total) * 100) : 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="إحصائيات الزيارات" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="إحصائيات الزيارات" description="تحليل الزيارات الإشرافية حسب العام والفصل المختار" backHref="/visits" />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="إجمالي الزيارات" value={k.total} icon={ClipboardCheck} tone="primary" hint={`${k.teacher} معلم · ${k.coordinator} منسق`} />
                    <StatCard title="المدارس المزارة" value={k.schools} icon={School} tone="info" />
                    <StatCard title="الموجهون النشطون" value={k.supervisors} icon={UserCog} tone="warning" />
                    <StatCard title="الاستمارات المعتمدة" value={`${finalizedPct}%`} icon={CheckCircle2} tone={finalizedPct >= 70 ? 'success' : 'warning'} hint={`${k.finalized} معتمدة · ${k.draft} مسودة`} />
                </div>

                {/* الاتجاه الزمني */}
                <TrendCard title="تطوّر الزيارات شهريًا" hint="عدد الزيارات المسجّلة في كل شهر" data={stats.byMonth} color={PALETTE[0]} height={280} />

                <div className="grid gap-6 lg:grid-cols-2">
                    <GaugeCard
                        title="مؤشرات الإنجاز"
                        hint="نسبة اعتماد الاستمارات ونصيب زيارات المعلمين"
                        items={[
                            { pct: finalizedPct, color: '#22C55E', label: 'اعتماد الاستمارات', sub: `${k.finalized}/${k.total}` },
                            { pct: k.total ? (k.teacher / k.total) * 100 : 0, color: PALETTE[0], label: 'زيارات المعلمين', sub: `${k.teacher}/${k.total}` },
                        ]}
                    />
                    <PieCard title="حالة الاستمارة" hint="معتمدة / مسودة / بدون استمارة" data={stats.formStatus} colors={['#22C55E', '#FF9F0A', '#94A3B8']} centerLabel="زيارة" />
                    <PieCard title="نوع الزيارة" hint="معلمون مقابل منسقين" data={stats.byType} colors={[PALETTE[0], PALETTE[3]]} centerLabel="زيارة" />
                    <BarCard title="الزيارات حسب القسم" data={stats.byDepartment} horizontal color={PALETTE[1]} />
                    <BarCard title="الزيارات حسب الموجّه" hint="أكثر الموجهين نشاطًا" data={stats.bySupervisor} horizontal color={PALETTE[2]} />
                    <BarCard title="أكثر المدارس زيارةً" data={stats.bySchool} horizontal color={PALETTE[4]} className="lg:col-span-2" />
                </div>
            </div>
        </AppLayout>
    );
}
