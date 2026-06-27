<?php

namespace App\Http\Concerns;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * منطق التنقّل الهرمي المشترك للصفحات التشغيلية:
 *  - رئيس التوجيه/المساعد ($canAll): الأقسام ← الموجهون ← محتوى موجّه.
 *  - رئيس القسم ($canDept): موجهو قسمه ← محتوى موجّه.
 *  - الموجه: محتواه مباشرة.
 *
 * المستوى يُشتقّ من معاملي الرابط ?department= و?supervisor=. يُمرّر المتحكّم
 * $canAll/$canDept بنفسه (تُحسب من الصلاحيات أو الأدوار حسب الوحدة).
 *
 * المرجع المعماري: VisitController::index() / TestReviewController::index().
 */
trait ResolvesDrilldown
{
    /**
     * يحدّد مستوى العرض والموجّه/القسم الفعّال مع احترام نطاق المستخدم.
     *
     * @return array{level:'departments'|'supervisors'|'content', departmentId:?int, supervisor:?User}
     */
    protected function resolveDrilldown(Request $request, User $user, bool $canAll, bool $canDept): array
    {
        // الموجه العادي: محتواه مباشرة (هو نفسه الموجّه).
        if (! $canAll && ! $canDept) {
            return ['level' => 'content', 'departmentId' => $user->department_id, 'supervisor' => $user];
        }

        $supervisorId = $request->integer('supervisor') ?: null;
        // رئيس القسم مقيّد بقسمه؛ رئيس التوجيه يختار القسم من الرابط.
        $departmentId = $canAll ? ($request->integer('department') ?: null) : $user->department_id;

        // المستوى الثالث: محتوى موجّه محدد.
        if ($supervisorId) {
            $supervisor = User::findOrFail($supervisorId);
            $this->authorizeSupervisorScope($user, $supervisor, $canAll, $canDept);

            return ['level' => 'content', 'departmentId' => $supervisor->department_id, 'supervisor' => $supervisor];
        }

        // المستوى الثاني: موجهو قسم محدد.
        if ($departmentId) {
            return ['level' => 'supervisors', 'departmentId' => $departmentId, 'supervisor' => null];
        }

        // المستوى الأول: الأقسام (رئيس التوجيه فقط).
        return ['level' => 'departments', 'departmentId' => null, 'supervisor' => null];
    }

    /** رئيس القسم لا يصل إلا لموجهي قسمه؛ رئيس التوجيه يصل للجميع. */
    protected function authorizeSupervisorScope(User $viewer, User $supervisor, bool $canAll, bool $canDept): void
    {
        if ($canAll) {
            return;
        }

        abort_unless(
            $canDept && $supervisor->department_id === $viewer->department_id,
            403,
        );
    }
}
