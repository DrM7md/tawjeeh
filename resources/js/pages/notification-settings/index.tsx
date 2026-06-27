import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type NotificationTypeSetting } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Bell, Radio, Save, Users } from 'lucide-react';

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
}

interface Props {
    settings: NotificationTypeSetting[];
    roles: RoleOption[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الإعدادات', href: '/settings' },
    { title: 'الإشعارات', href: '/notification-settings' },
];

export default function NotificationSettingsPage({ settings, roles }: Props) {
    const { data, setData, put, processing } = useForm<{ settings: NotificationTypeSetting[] }>({ settings });

    const patch = (index: number, changes: Partial<NotificationTypeSetting>) => {
        setData(
            'settings',
            data.settings.map((s, i) => (i === index ? { ...s, ...changes } : s)),
        );
    };

    const toggleRole = (index: number, roleName: string) => {
        const current = data.settings[index].recipient_roles;
        const next = current.includes(roleName) ? current.filter((r) => r !== roleName) : [...current, roleName];
        patch(index, { recipient_roles: next });
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put('/notification-settings', { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="إعدادات الإشعارات" />
            <form onSubmit={submit} className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="إعدادات الإشعارات"
                    description="تحكّم في كل نوع إشعار: من يستلمه، وحصره بنطاق القسم، وتفعيل البث اللحظي."
                    actions={
                        <Button type="submit" disabled={processing}>
                            <Save className="ml-2 size-4" />
                            حفظ الإعدادات
                        </Button>
                    }
                />

                <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                    يُحفظ كل إشعار في النظام ويظهر فورًا عبر الاستعلام الدوري (Polling). فعّل «البث اللحظي» لنوعٍ ما لدفعه لحظيًا عبر WebSockets
                    (يتطلب تشغيل خادم البث).
                </p>

                <div className="grid gap-4">
                    {data.settings.map((setting, index) => (
                        <Card key={setting.type} className={cn('p-5', !setting.enabled && 'opacity-70')}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                                        <Bell className="size-5" />
                                    </span>
                                    <div className="space-y-1">
                                        <h3 className="font-semibold">{setting.label}</h3>
                                        <p className="text-muted-foreground text-sm">{setting.description}</p>
                                    </div>
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <Checkbox checked={setting.enabled} onCheckedChange={(v) => patch(index, { enabled: Boolean(v) })} />
                                    <span className="font-medium">{setting.enabled ? 'مُفعّل' : 'مُعطّل'}</span>
                                </label>
                            </div>

                            {setting.enabled && (
                                <div className="mt-5 space-y-5 border-t pt-5">
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                                            <Users className="size-4" /> من يستلم هذا الإشعار؟
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {roles.map((role) => {
                                                const checked = setting.recipient_roles.includes(role.name);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={role.id}
                                                        onClick={() => toggleRole(index, role.name)}
                                                        className={cn(
                                                            'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
                                                            checked
                                                                ? 'border-primary bg-primary/10 text-primary'
                                                                : 'border-border text-muted-foreground hover:bg-muted',
                                                        )}
                                                    >
                                                        <Checkbox checked={checked} className="pointer-events-none size-4" />
                                                        {role.display_name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {setting.recipient_roles.length === 0 && (
                                            <p className="text-destructive text-xs">لم يُحدَّد مستلِم — لن يصل هذا الإشعار لأحد.</p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-6">
                                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                                            <Checkbox
                                                checked={setting.department_scoped}
                                                onCheckedChange={(v) => patch(index, { department_scoped: Boolean(v) })}
                                            />
                                            <span>
                                                <span className="font-medium">حصر بنطاق القسم</span>
                                                <span className="text-muted-foreground block text-xs">يصل فقط لمن في قسم الحدث (والإدارة العُليا).</span>
                                            </span>
                                        </label>
                                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                                            <Checkbox checked={setting.live} onCheckedChange={(v) => patch(index, { live: Boolean(v) })} />
                                            <span>
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <Radio className="size-4" /> بث لحظي (WebSockets)
                                                </span>
                                                <span className="text-muted-foreground block text-xs">دفع فوري إضافةً للاستعلام الدوري.</span>
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            </form>
        </AppLayout>
    );
}
