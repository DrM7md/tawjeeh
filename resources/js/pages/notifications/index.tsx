import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type NotificationItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Award, Bell, CalendarDays, CheckCheck, ClipboardCheck, Inbox, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
    visit: ClipboardCheck,
    review: Award,
    calendar: CalendarDays,
    bell: Bell,
};

interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    notifications: Paginated<NotificationItem>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الإشعارات', href: '/notifications' },
];

function timeLabel(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 604800) return `قبل ${Math.floor(diff / 86400)} يوم`;
    return new Date(iso).toLocaleString('ar');
}

export default function NotificationsIndex({ notifications }: Props) {
    const items = notifications.data;
    const hasUnread = items.some((n) => !n.read_at);

    const markAll = () => {
        router.post('/notifications/read-all', {}, { preserveScroll: true });
    };

    const onOpen = (item: NotificationItem) => {
        if (!item.read_at) {
            router.post(`/notifications/${item.id}/read`, {}, { preserveScroll: true, preserveState: true });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="الإشعارات" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="الإشعارات"
                    description="كل الإشعارات التي وصلتك"
                    actions={
                        hasUnread ? (
                            <Button variant="outline" onClick={markAll}>
                                <CheckCheck className="ml-2 size-4" />
                                تمييز الكل كمقروء
                            </Button>
                        ) : undefined
                    }
                />

                {items.length === 0 ? (
                    <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
                        <Inbox className="size-10 opacity-50" />
                        لا توجد إشعارات بعد
                    </div>
                ) : (
                    <div className="divide-border overflow-hidden rounded-2xl border">
                        {items.map((item) => {
                            const Icon = ICONS[item.icon ?? 'bell'] ?? Bell;
                            const unread = !item.read_at;
                            const Row = (
                                <div className={cn('flex items-start gap-4 p-4 transition hover:bg-muted/50', unread && 'bg-primary/5')}>
                                    <span
                                        className={cn(
                                            'flex size-10 shrink-0 items-center justify-center rounded-xl',
                                            unread ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        <Icon className="size-5" />
                                    </span>
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        <p className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>{item.title}</p>
                                        <p className="text-muted-foreground text-sm">{item.message}</p>
                                        <p className="text-muted-foreground/70 text-xs">{timeLabel(item.created_at)}</p>
                                    </div>
                                    {unread && <span className="bg-primary mt-2 size-2 shrink-0 rounded-full" aria-label="غير مقروء" />}
                                </div>
                            );
                            return (
                                <div key={item.id} className="border-b last:border-b-0">
                                    {item.url ? (
                                        <Link href={item.url} onClick={() => onOpen(item)} className="block">
                                            {Row}
                                        </Link>
                                    ) : (
                                        <button type="button" onClick={() => onOpen(item)} className="block w-full text-right">
                                            {Row}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {notifications.last_page > 1 && (
                    <div className="flex flex-wrap justify-center gap-1">
                        {notifications.links.map((link, i) => (
                            <Button
                                key={i}
                                variant={link.active ? 'default' : 'outline'}
                                size="sm"
                                disabled={!link.url}
                                onClick={() => link.url && router.visit(link.url, { preserveScroll: true })}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
