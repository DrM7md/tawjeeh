import { usePage } from '@inertiajs/react';

interface PageAuth {
    auth?: {
        permissions?: string[];
        is_super?: boolean;
    };
}

/**
 * Hook الصلاحيات — يقرأ صلاحيات المستخدم المشتركة عبر Inertia.
 * يكتمل تفعيله في Phase 1 (RBAC). حتى ذلك الحين يعتمد على المشاركة إن وُجدت.
 */
export function usePermissions() {
    const { props } = usePage<PageAuth>();
    const permissions = props.auth?.permissions ?? [];
    const isSuper = props.auth?.is_super ?? false;

    const can = (permission?: string) => {
        if (!permission) return true;
        if (isSuper) return true;
        return permissions.includes(permission);
    };

    return { can, permissions, isSuper };
}

/** يعرض الأبناء فقط إذا كان المستخدم يملك الصلاحية. */
export function Can({ permission, children }: { permission?: string; children: React.ReactNode }) {
    const { can } = usePermissions();
    if (!can(permission)) return null;
    return <>{children}</>;
}
