import { Breadcrumbs } from '@/components/breadcrumbs';
import { ContextSwitcher } from '@/components/context-switcher';
import { HeaderUserMenu } from '@/components/header-user-menu';
import { NotificationBell } from '@/components/notification-bell';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    return (
        <header
            data-app-header
            className="border-sidebar-border/50 flex h-16 shrink-0 items-center justify-between gap-2 border-b px-3 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 sm:px-4 md:px-6"
        >
            <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="-mr-1" />
                <div className="hidden min-w-0 sm:block">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
            </div>
            <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                <ContextSwitcher />
                <NotificationBell />
                <HeaderUserMenu />
            </div>
        </header>
    );
}
