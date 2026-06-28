import { NavMain } from '@/components/nav-main';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { Award, Building2, CalendarDays, ClipboardCheck, ClipboardList, FolderCheck, LayoutGrid, Layers, Network, School, Settings2, TrendingUp, UserCheck, Users } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    { title: 'لوحة التحكم', url: '/dashboard', icon: LayoutGrid },
    { title: 'التقويم', url: '/calendar', icon: CalendarDays, permission: 'calendar.view' },
    { title: 'توزيع المدارس', url: '/distribution', icon: Network, permission: 'distribution.view' },
    { title: 'التصنيف والالتزام', url: '/classification', icon: Layers, permission: 'classification.view' },
    { title: 'خطة الموجّه', url: '/planning', icon: ClipboardList, permission: 'planning.view.own' },
    { title: 'الزيارات والمتابعة', url: '/visits', icon: ClipboardCheck, permission: 'visits.view.own' },
    { title: 'تحكيم الاختبارات', url: '/reviews', icon: Award, permission: 'reviews.view.own' },
    { title: 'تقييم ملفات المنسق', url: '/portfolios', icon: FolderCheck, permission: 'portfolios.view.own' },
    { title: 'خطط التحسين والتطوير', url: '/improvement', icon: TrendingUp, permission: 'improvement.view.own' },
];

// الهيكل التنظيمي
const organizationNavItems: NavItem[] = [
    { title: 'الأقسام', url: '/departments', icon: Building2, permission: 'departments.view' },
    { title: 'المدارس', url: '/schools', icon: School, permission: 'schools.view' },
    { title: 'المنسقون', url: '/coordinators', icon: UserCheck, permission: 'coordinators.view' },
    { title: 'المستخدمون', url: '/users', icon: Users, permission: 'users.view' },
];

// أخرى — الإعدادات تجمع (إعدادات الهيكل/الأدوار/سجل النشاط/النسخ الاحتياطي + الحساب)
const otherNavItems: NavItem[] = [
    { title: 'الإعدادات', url: '/settings', icon: Settings2 },
];

export function AppSidebar() {
    return (
        <Sidebar side="right" collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} label="الرئيسية" />
                <NavMain items={organizationNavItems} label="الهيكل التنظيمي" />
                <NavMain items={otherNavItems} label="أخرى" />
            </SidebarContent>
        </Sidebar>
    );
}
