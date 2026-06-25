<?php

namespace App\Providers;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\ActiveContext;
use App\Support\Permissions;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // السياق الأكاديمي — نسخة واحدة لكل طلب (تخزّن العام/الفصل المختار).
        $this->app->singleton(ActiveContext::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // رئيس التوجيه (super) يتجاوز كل الفحوصات.
        Gate::before(fn (User $user) => $user->isSuper() ? true : null);

        // تسجيل كل مفاتيح الصلاحيات كـ Gates ديناميكيًا.
        foreach (Permissions::all() as $permission) {
            Gate::define($permission, fn (User $user) => $user->hasPermission($permission));
        }

        // تحديث آخر دخول + تسجيله في سجل النشاط (دون إطلاق حدث تعديل).
        Event::listen(Login::class, function (Login $event) {
            $event->user->forceFill(['last_login_at' => now()])->saveQuietly();
            AuditLog::create([
                'user_id' => $event->user->getAuthIdentifier(),
                'action' => 'login',
                'ip_address' => request()->ip(),
                'user_agent' => substr((string) request()->userAgent(), 0, 255),
            ]);
        });
    }
}
