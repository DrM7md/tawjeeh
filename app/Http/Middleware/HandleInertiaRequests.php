<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user = $request->user();

        return array_merge(parent::share($request), [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                // ملاحظة: نُضمّن عمود permissions لأن share() يعمل قبل can middleware،
                // وإلا تُحمّل علاقة roles بأعمدة ناقصة فتفشل فحوص الصلاحيات اللاحقة.
                'user' => $user
                    ? $user->loadMissing(['roles:id,name,display_name,level,permissions', 'department:id,name'])
                    : null,
                'permissions' => $user?->permissions() ?? [],
                'is_super' => $user?->isSuper() ?? false,
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            // السياق الأكاديمي (العام/الفصل المختار) — متاح للمستخدمين المصادَقين فقط.
            'context' => $user ? app(\App\Support\ActiveContext::class)->share() : null,
        ]);
    }
}
