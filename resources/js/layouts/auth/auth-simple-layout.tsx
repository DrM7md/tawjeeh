import AppLogoIcon from '@/components/app-logo-icon';
import { Link } from '@inertiajs/react';
import { BarChart3, CalendarCheck2, ClipboardCheck } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
    name?: string;
    title?: string;
    description?: string;
}

const features = [
    { icon: ClipboardCheck, label: 'متابعة الزيارات والتقارير الميدانية' },
    { icon: BarChart3, label: 'لوحات إحصائية ومؤشرات أداء فورية' },
    { icon: CalendarCheck2, label: 'تقويم ومهام ذكية لفرق التوجيه' },
];

export default function AuthSimpleLayout({ children, title, description }: AuthLayoutProps) {
    return (
        <div className="flex min-h-svh w-full">
            {/* لوحة النموذج */}
            <div className="flex flex-1 items-center justify-center bg-background p-6 md:p-10">
                <div className="w-full max-w-sm">
                    {/* شعار للأجهزة الصغيرة */}
                    <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
                        <Link
                            href={route('home')}
                            className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                        >
                            <AppLogoIcon className="size-8" />
                        </Link>
                        <span className="text-base font-bold">نظام توجيه</span>
                    </div>

                    <div className="flex flex-col gap-2 text-center lg:text-right">
                        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                    </div>

                    <div className="mt-8">{children}</div>
                </div>
            </div>

            {/* اللوحة التعريفية العنابية — تظهر على الشاشات الكبيرة */}
            <div className="bg-sidebar text-sidebar-foreground relative hidden w-1/2 max-w-2xl flex-col justify-between overflow-hidden p-12 lg:flex">
                {/* زخارف خلفية ناعمة */}
                <div aria-hidden className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-24 right-0 h-96 w-96 translate-x-1/3 rounded-full bg-white/[0.06] blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-80 w-80 -translate-x-1/3 translate-y-1/3 rounded-full bg-white/[0.05] blur-3xl" />
                    <AppLogoIcon className="absolute -bottom-20 -left-16 size-[26rem] text-white/[0.035]" />
                </div>

                {/* الشعار */}
                <div className="relative flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                        <AppLogoIcon className="size-7 text-white" />
                    </div>
                    <div className="grid">
                        <span className="text-lg leading-tight font-bold text-white">نظام توجيه</span>
                        <span className="text-sidebar-foreground/70 text-sm">إدارة التوجيه التربوي</span>
                    </div>
                </div>

                {/* الرسالة التعريفية */}
                <div className="relative space-y-6">
                    <h2 className="text-3xl leading-snug font-bold text-white">
                        منصّة متكاملة لإدارة
                        <br />
                        التوجيه التربوي
                    </h2>
                    <p className="text-sidebar-foreground/80 max-w-md text-base leading-relaxed">
                        تخطيط، إشراف، ومتابعة أداء الموجّهين والمدارس في مكان واحد — بلوحات تحكّم ذكية وتقارير لحظية.
                    </p>
                    <ul className="space-y-3 pt-2">
                        {features.map(({ icon: Icon, label }) => (
                            <li key={label} className="flex items-center gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                                    <Icon className="size-4.5 text-white" />
                                </span>
                                <span className="text-sidebar-foreground/90 text-sm">{label}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="text-sidebar-foreground/50 relative text-xs">© نظام توجيه — جميع الحقوق محفوظة</p>
            </div>
        </div>
    );
}
