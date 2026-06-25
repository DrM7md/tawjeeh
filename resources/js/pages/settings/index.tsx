import { PageHeader } from '@/components/shared/page-header';
import { usePermissions } from '@/components/shared/can';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { type LucideIcon, Database, History, Layers, Palette, ShieldCheck, UserCog, KeyRound, ChevronLeft } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الإعدادات', href: '/settings' },
];

interface Card {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    permission?: string;
}

const systemCards: Card[] = [
    { title: 'إعدادات الهيكل', description: 'المراحل الدراسية وتصنيفات المعلمين', href: '/organization-settings', icon: Layers, permission: 'settings.manage' },
    { title: 'الأدوار والصلاحيات', description: 'تعريف الأدوار وضبط الصلاحيات', href: '/roles', icon: ShieldCheck, permission: 'roles.view' },
    { title: 'سجل النشاط', description: 'توثيق عمليات النظام الحسّاسة', href: '/audit', icon: History, permission: 'audit.view' },
    { title: 'النسخ الاحتياطي', description: 'إنشاء وإدارة نسخ قاعدة البيانات', href: '/backups', icon: Database, permission: 'backup.manage' },
];

const accountCards: Card[] = [
    { title: 'الملف الشخصي', description: 'تعديل الاسم والبريد الإلكتروني', href: '/settings/profile', icon: UserCog },
    { title: 'كلمة المرور', description: 'تغيير كلمة المرور', href: '/settings/password', icon: KeyRound },
    { title: 'المظهر', description: 'الوضع الفاتح والداكن', href: '/settings/appearance', icon: Palette },
];

function SettingCard({ card }: { card: Card }) {
    const Icon = card.icon;
    return (
        <Link
            href={card.href}
            className="glass hover-lift group flex items-center gap-4 rounded-2xl border border-border/60 p-5"
        >
            <div className="bg-primary/10 flex size-12 shrink-0 items-center justify-center rounded-xl">
                <Icon className="text-primary size-6" />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{card.title}</h3>
                <p className="text-muted-foreground truncate text-sm">{card.description}</p>
            </div>
            <ChevronLeft className="text-muted-foreground size-5 transition group-hover:-translate-x-1" />
        </Link>
    );
}

export default function SettingsHub() {
    const { can } = usePermissions();
    const visibleSystem = systemCards.filter((c) => can(c.permission));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="الإعدادات" />
            <div className="flex flex-col gap-8 p-4 md:p-6">
                <PageHeader title="الإعدادات" description="إدارة إعدادات النظام وحسابك من مكان واحد" />

                {visibleSystem.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold">إعدادات النظام</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleSystem.map((c) => (
                                <SettingCard key={c.href} card={c} />
                            ))}
                        </div>
                    </section>
                )}

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">حسابي</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {accountCards.map((c) => (
                            <SettingCard key={c.href} card={c} />
                        ))}
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}
