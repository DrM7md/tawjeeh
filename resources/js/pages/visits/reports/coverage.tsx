import { navigate, ReportHeader } from '@/components/visits/report-bits';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CheckCircle2, MinusCircle, User } from 'lucide-react';
import { useState } from 'react';

interface TeacherCov {
    name: string;
    visited: boolean;
    visits: number;
    last_visit: string | null;
}
interface PageProps {
    teacherCoverage: TeacherCov[];
    visitors: { id: number; name: string }[];
    selectedVisitorId: number | null;
    summary: { teachersTotal: number; teachersVisited: number };
    activeYear: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'الزيارات', href: '/visits' },
    { title: 'تغطية الزيارات', href: '/supervision-reports/coverage' },
];

function Ring({ value, total }: { value: number; total: number }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="relative size-16 shrink-0">
            <svg className="size-16 -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#7b1c2e" strokeWidth="3" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold tnum">{pct}%</span>
        </div>
    );
}

export default function Coverage({ teacherCoverage, visitors, selectedVisitorId, summary, activeYear }: PageProps) {
    const [remainingOnly, setRemainingOnly] = useState(false);
    const shown = remainingOnly ? teacherCoverage.filter((t) => !t.visited) : teacherCoverage;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="تغطية الزيارات الإشرافية" />
            <div className="flex flex-col gap-4 p-4 md:p-6">
                <ReportHeader title="تغطية الزيارات الإشرافية" subtitle={`متابعة من تمّت زيارته ومن تبقّى من المعلمين${activeYear ? ` — ${activeYear}` : ''}`} printUrl={`/supervision-reports/print?type=coverage${selectedVisitorId ? `&visitor_id=${selectedVisitorId}` : ''}`} />

                <Card>
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <span className="text-muted-foreground text-sm font-bold">الزائر:</span>
                        <Select value={selectedVisitorId ? String(selectedVisitorId) : 'all'} onValueChange={(v) => navigate('/supervision-reports/coverage', { visitor_id: v === 'all' ? undefined : v })}>
                            <SelectTrigger className="min-w-[200px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">جميع الزائرين</SelectItem>
                                {visitors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden p-0">
                    <CardContent className="flex items-center gap-3 border-b border-border/60 p-4">
                        <Ring value={summary.teachersVisited} total={summary.teachersTotal} />
                        <div className="flex-1">
                            <h2 className="flex items-center gap-1.5 text-sm font-bold"><User className="size-4" /> المعلمون</h2>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                تمت زيارة <span className="font-bold text-emerald-600">{summary.teachersVisited}</span> من {summary.teachersTotal} — المتبقّي <span className="font-bold text-amber-600">{summary.teachersTotal - summary.teachersVisited}</span>
                            </p>
                        </div>
                        <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={remainingOnly} onChange={(e) => setRemainingOnly(e.target.checked)} className="rounded" />
                            المتبقّون فقط
                        </label>
                    </CardContent>
                    <ul className="max-h-[560px] divide-y divide-border/60 overflow-y-auto">
                        {shown.length === 0 && <li className="text-muted-foreground py-8 text-center text-sm">{remainingOnly ? 'تمت تغطية الجميع 🎉' : 'لا يوجد'}</li>}
                        {shown.map((it, i) => (
                            <li key={i} className={cn('flex items-center gap-3 px-4 py-2.5', !it.visited && 'bg-amber-50/40 dark:bg-amber-950/20')}>
                                {it.visited ? <CheckCircle2 className="size-5 shrink-0 text-emerald-500" /> : <MinusCircle className="size-5 shrink-0 text-amber-400" />}
                                <span className="flex-1 text-sm font-medium">{it.name}</span>
                                {it.visited ? (
                                    <span className="text-muted-foreground text-[11px]">{it.visits} زيارة{it.last_visit ? ` · ${it.last_visit}` : ''}</span>
                                ) : (
                                    <span className="text-[11px] font-bold text-amber-600">لم تتم زيارته</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </AppLayout>
    );
}
