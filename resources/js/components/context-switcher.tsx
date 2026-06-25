import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type AcademicContext, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { BookOpen, CalendarDays } from 'lucide-react';

/** Hook للوصول للسياق الأكاديمي المشترك. */
export function useAcademicContext(): AcademicContext | null {
    const { props } = usePage<SharedData & { context: AcademicContext | null }>();
    return props.context ?? null;
}

const yearSuffix = (status: string, isActive: boolean): string => {
    if (isActive) return ' • نشط';
    if (status === 'archived') return ' • أرشيف';
    if (status === 'closed') return ' • مغلق';
    return '';
};

/** محدّد العام/الفصل الدراسي في الترويسة. عند التبديل تُعاد كل بيانات الصفحة. */
export function ContextSwitcher() {
    const context = useAcademicContext();
    if (!context || context.years.length === 0) return null;

    const changeYear = (yearId: string) => {
        router.post('/context', { year_id: yearId }, { preserveScroll: true });
    };

    const changeSemester = (semesterId: string) => {
        router.post('/context', { semester_id: semesterId }, { preserveScroll: true });
    };

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
                <CalendarDays className="text-muted-foreground size-4" />
                <Select value={context.selectedYearId ? String(context.selectedYearId) : undefined} onValueChange={changeYear}>
                    <SelectTrigger className="h-9 min-w-[130px] text-xs">
                        <SelectValue placeholder="العام" />
                    </SelectTrigger>
                    <SelectContent>
                        {context.years.map((y) => (
                            <SelectItem key={y.id} value={String(y.id)}>
                                {y.name}
                                {yearSuffix(y.status, y.is_active)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {context.semesters.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <BookOpen className="text-muted-foreground size-4" />
                    <Select value={context.selectedSemesterId ? String(context.selectedSemesterId) : undefined} onValueChange={changeSemester}>
                        <SelectTrigger className="h-9 min-w-[120px] text-xs">
                            <SelectValue placeholder="الفصل" />
                        </SelectTrigger>
                        <SelectContent>
                            {context.semesters.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                    {s.name}
                                    {s.is_active ? ' • نشط' : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}
