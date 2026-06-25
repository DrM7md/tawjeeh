import { useEffect } from 'react';

interface PrintLayoutProps {
    title: string;
    subtitle?: string;
    /** قائمة (مفتاح: قيمة) تظهر في شريط المعلومات أعلى التقرير */
    meta?: Record<string, string | number>;
    /** طباعة تلقائية عند الفتح */
    autoPrint?: boolean;
    children: React.ReactNode;
}

/**
 * تخطيط الطباعة (A4 RTL) — يُستخدم لكل صفحات التقارير القابلة للطباعة.
 * أنماط الطباعة الأساسية معرّفة عالميًا في app.css (@media print).
 * (يكتمل تطويره في Phase 8: ترويسة/تذييل متكرّران + «صفحة X من Y».)
 */
export default function PrintLayout({ title, subtitle, meta, autoPrint = false, children }: PrintLayoutProps) {
    useEffect(() => {
        if (autoPrint) {
            const t = setTimeout(() => window.print(), 500);
            return () => clearTimeout(t);
        }
    }, [autoPrint]);

    return (
        <div className="mx-auto max-w-[210mm] bg-white p-8 text-black">
            <header className="border-primary mb-6 border-b-2 pb-4">
                <h1 className="text-2xl font-bold text-primary">{title}</h1>
                {subtitle && <p className="text-sm text-neutral-600">{subtitle}</p>}
                {meta && (
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        {Object.entries(meta).map(([k, v]) => (
                            <span key={k}>
                                <span className="font-semibold">{k}:</span> <span className="tnum">{v}</span>
                            </span>
                        ))}
                    </div>
                )}
            </header>

            <main>{children}</main>

            <footer className="mt-8 border-t pt-3 text-xs text-neutral-500">
                نظام توجيه — إدارة التوجيه التربوي
            </footer>
        </div>
    );
}
