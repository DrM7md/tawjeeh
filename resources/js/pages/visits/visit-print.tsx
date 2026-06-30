import { Head } from '@inertiajs/react';
import { useEffect } from 'react';

interface StandardRow {
    name: string;
    rating: number;
    recommendation: string | null;
}
interface DomainRow {
    name: string;
    percent: number | null;
    standards: StandardRow[];
}
interface PageProps {
    visit: {
        school: string | null;
        department: string | null;
        supervisor: string | null;
        teacher: string | null;
        visit_date: string | null;
        day_name: string | null;
        hijri_date: string | null;
        visit_number: number | null;
        follow_up_type: string | null;
        section: string | null;
        lesson_topic: string | null;
        overall_rating: number | null;
    };
    domains: DomainRow[];
    generalNotes: string | null;
}

const MAROON = '#7a1f2e';
const GRAY = '#e9e9e9';
const BORDER = '#8c8c8c';

// أعمدة الأدلة بالترتيب من الأعلى (4) إلى لم يُقَس (0).
const EVIDENCE_COLS = [
    'الأدلة مستكملة وفاعلة', // 4
    'تتوفر معظم الأدلة', // 3
    'تتوفر بعض الأدلة', // 2
    'الأدلة غير متوفرة أو محدودة', // 1
    'لم يتم قياسه', // 0
];

// خيارات نوع المتابعة كما في النموذج الرسمي.
const FOLLOW_OPTIONS = ['ميدانية', 'عن بُعد', 'جزئية', 'كلية', 'بث مباشر مدمج', 'بث مباشر غير مدمج'];

function colIndexForRating(rating: number): number {
    // 4→0, 3→1, 2→2, 1→3, 0/غير ذلك→4
    if (rating >= 1 && rating <= 4) return 4 - rating;
    return 4;
}

function Check({ on }: { on: boolean }) {
    return (
        <span
            style={{
                display: 'inline-block',
                width: 13,
                height: 13,
                border: `1px solid ${BORDER}`,
                lineHeight: '12px',
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#111',
                verticalAlign: 'middle',
            }}
        >
            {on ? '✓' : ''}
        </span>
    );
}

export default function VisitPrint({ visit, domains, generalNotes }: PageProps) {
    useEffect(() => {
        const t = setTimeout(() => window.print(), 600);
        return () => clearTimeout(t);
    }, []);

    const followType = visit.follow_up_type ?? '';

    return (
        <div dir="rtl" style={{ padding: 18, color: '#111', background: '#fff' }}>
            <Head title={`استمارة الإشراف — ${visit.teacher ?? ''}`} />
            <style>{`
                @media print { .no-print { display: none !important } @page { size: A4; margin: 9mm } }
                .vp { font-family: inherit; }
                .vp table { border-collapse: collapse; width: 100%; }
                .vp td, .vp th { border: 1px solid ${BORDER}; padding: 4px 6px; font-size: 12px; vertical-align: middle; }
                .vp .vert { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; text-align: center; padding: 6px 2px; }
                .vp .lbl { background: ${GRAY}; font-weight: 700; text-align: center; white-space: nowrap; }
                .vp .maroon { background: ${MAROON}; color: #fff; font-weight: 700; text-align: center; }
                .vp .band { background: ${MAROON}; color: #fff; font-weight: 800; text-align: center; font-size: 14px; padding: 6px; letter-spacing: .5px; }
                .vp .ev { width: 28px; text-align: center; font-size: 14px; font-weight: 700; }
            `}</style>

            <div className="vp">
                {/* ترويسة النموذج */}
                <table>
                    <tbody>
                        <tr>
                            <td style={{ width: '28%', textAlign: 'center', lineHeight: 1.6 }}>
                                <div style={{ fontWeight: 800, color: MAROON }}>إدارة التوجيه التربوي</div>
                                <div style={{ fontWeight: 700 }}>قسم {visit.department ?? '—'}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, color: MAROON }}>
                                استمارة الإشراف على أداء المعلم
                            </td>
                            <td style={{ width: '28%', textAlign: 'center', lineHeight: 1.5, fontSize: 11 }}>
                                <div style={{ fontWeight: 700 }}>وزارة التربية والتعليم والتعليم العالي</div>
                                <div style={{ direction: 'ltr', color: '#444' }}>Ministry of Education and Higher Education</div>
                                <div style={{ color: '#444' }}>دولة قطر · State of Qatar</div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* المعلومات الأساسية */}
                <table style={{ marginTop: 8 }}>
                    <tbody>
                        <tr>
                            <td colSpan={6} className="band">المعلومات الأساسية</td>
                        </tr>
                        <tr>
                            <td className="lbl" style={{ width: '11%' }}>المدرسة</td>
                            <td style={{ width: '31%' }}>{visit.school ?? '—'}</td>
                            <td className="lbl" style={{ width: '12%' }}>اليوم / التاريخ</td>
                            <td style={{ width: '15%', textAlign: 'center' }}>{visit.day_name ?? '—'}</td>
                            <td style={{ width: '15%', textAlign: 'center' }}>{visit.hijri_date ?? '—'}</td>
                            <td style={{ width: '16%', textAlign: 'center' }}>{visit.visit_date ?? '—'}</td>
                        </tr>
                        <tr>
                            <td className="lbl">المادة</td>
                            <td>{visit.department ?? '—'}</td>
                            <td className="lbl">الموضوع</td>
                            <td colSpan={3}>{visit.lesson_topic ?? '—'}</td>
                        </tr>
                        <tr>
                            <td className="lbl">الصف</td>
                            <td>{visit.section ?? '—'}</td>
                            <td className="lbl">المعلم</td>
                            <td colSpan={3}>{visit.teacher ?? '—'}</td>
                        </tr>
                        <tr>
                            <td className="lbl">الموجّه التربوي</td>
                            <td>{visit.supervisor ?? '—'}</td>
                            <td className="lbl">نوع المتابعة</td>
                            <td colSpan={3}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
                                    {FOLLOW_OPTIONS.map((opt) => (
                                        <span key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                                            <Check on={followType.includes(opt)} /> {opt}
                                        </span>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* جدول المعايير */}
                <table style={{ marginTop: 8 }}>
                    <thead>
                        <tr>
                            <th className="lbl vert" style={{ width: 26 }}>المجال</th>
                            <th className="lbl" style={{ width: '40%' }}>معايير الأداء</th>
                            {EVIDENCE_COLS.map((c) => (
                                <th key={c} className="lbl vert ev" style={{ height: 120, fontSize: 9.5, fontWeight: 600 }}>
                                    {c}
                                </th>
                            ))}
                            <th className="lbl" style={{ width: '26%' }}>
                                التوصيات
                                <div style={{ fontWeight: 400, fontSize: 9, color: '#555' }}>
                                    (تتضمن توجيهات لزيادة أثر الممارسات في تعلّم الطالب)
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {domains.map((domain, di) => {
                            const recs = Array.from(
                                new Set(domain.standards.map((s) => (s.recommendation ?? '').trim()).filter(Boolean)),
                            );
                            return domain.standards.map((s, si) => {
                                const colIdx = colIndexForRating(s.rating);
                                return (
                                    <tr key={`${di}-${si}`}>
                                        {si === 0 && (
                                            <td rowSpan={domain.standards.length} className="lbl vert">
                                                {domain.name}
                                            </td>
                                        )}
                                        <td style={{ textAlign: 'right' }}>{s.name}</td>
                                        {EVIDENCE_COLS.map((_, ci) => (
                                            <td key={ci} className="ev">
                                                {ci === colIdx ? '✓' : ''}
                                            </td>
                                        ))}
                                        {si === 0 && (
                                            <td rowSpan={domain.standards.length} style={{ textAlign: 'right', verticalAlign: 'top', fontSize: 11, lineHeight: 1.7 }}>
                                                {recs.length > 0
                                                    ? recs.map((r, ri) => (
                                                          <div key={ri} style={{ marginBottom: 4 }}>
                                                              {r}
                                                          </div>
                                                      ))
                                                    : ''}
                                            </td>
                                        )}
                                    </tr>
                                );
                            });
                        })}
                    </tbody>
                </table>

                {/* ملاحظات وتوصيات عامة */}
                <table style={{ marginTop: 8 }}>
                    <tbody>
                        <tr>
                            <td className="band" style={{ fontSize: 13 }}>ملاحظات وتوصيات عامة</td>
                        </tr>
                        <tr>
                            <td style={{ textAlign: 'right', whiteSpace: 'pre-wrap', lineHeight: 1.9, minHeight: 60, height: 80, verticalAlign: 'top' }}>
                                {generalNotes ?? ''}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* التواقيع */}
                <table style={{ marginTop: 8 }}>
                    <tbody>
                        <tr>
                            <td className="maroon" style={{ width: '20%' }}>توقيع المعلم</td>
                            <td style={{ width: '30%' }}></td>
                            <td className="maroon" style={{ width: '20%' }}>توقيع الموجّه التربوي</td>
                            <td style={{ width: '30%' }}></td>
                        </tr>
                    </tbody>
                </table>

                {/* تذييل النموذج */}
                <table style={{ marginTop: 8 }}>
                    <tbody>
                        <tr style={{ fontSize: 10 }}>
                            <td className="lbl" style={{ fontWeight: 400 }}>رمز النموذج: ES-ESI-P10-F2</td>
                            <td className="lbl" style={{ fontWeight: 400 }}>رقم الإصدار: 1</td>
                            <td className="lbl" style={{ fontWeight: 400 }}>تاريخ الإصدار: 21-05-2024</td>
                            <td className="lbl" style={{ fontWeight: 400 }}>التصنيف: داخلي</td>
                            <td className="lbl" style={{ fontWeight: 400 }}>الصفحة 1 من 1</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <button
                className="no-print"
                onClick={() => window.print()}
                style={{ position: 'fixed', top: 16, left: 16, padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer' }}
            >
                طباعة
            </button>
        </div>
    );
}
