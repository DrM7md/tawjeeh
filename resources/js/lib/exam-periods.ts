/** الاختبارات الأربعة عبر الفصلين — مصدر موحّد للقيم والتسميات. */
export interface ExamPeriod {
    /** القيمة المخزّنة في قاعدة البيانات */
    value: string;
    /** تسمية مختصرة للتابات */
    label: string;
    /** التسمية الكاملة للعرض */
    full: string;
}

export const EXAM_PERIODS: ExamPeriod[] = [
    { value: 'mid_first', label: 'منتصف الأول', full: 'منتصف الفصل الدراسي الأول' },
    { value: 'final_first', label: 'نهاية الأول', full: 'نهاية الفصل الدراسي الأول' },
    { value: 'mid_second', label: 'منتصف الثاني', full: 'منتصف الفصل الدراسي الثاني' },
    { value: 'final_second', label: 'نهاية الثاني', full: 'نهاية الفصل الدراسي الثاني' },
];

const FULL = Object.fromEntries(EXAM_PERIODS.map((e) => [e.value, e.full]));
const SHORT = Object.fromEntries(EXAM_PERIODS.map((e) => [e.value, e.label]));

/** التسمية الكاملة لاختبار، أو «—» إن لم يُحدّد. */
export const examPeriodLabel = (value?: string | null): string => (value ? (FULL[value] ?? value) : '—');

/** التسمية المختصرة لاختبار، أو «—» إن لم يُحدّد. */
export const examPeriodShort = (value?: string | null): string => (value ? (SHORT[value] ?? value) : '—');
