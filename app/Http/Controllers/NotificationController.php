<?php

namespace App\Http\Controllers;

use App\Notifications\NotificationPresenter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    /** صفحة سجل كل الإشعارات. */
    public function index(Request $request): Response
    {
        $notifications = $request->user()->notifications()
            ->latest()
            ->paginate(30)
            ->through(fn ($n) => NotificationPresenter::make($n));

        return Inertia::render('notifications/index', [
            'notifications' => $notifications,
        ]);
    }

    /** تمييز إشعار واحد كمقروء. */
    public function markRead(Request $request, string $id): RedirectResponse
    {
        $request->user()->notifications()
            ->whereKey($id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return back();
    }

    /** تمييز كل الإشعارات كمقروءة. */
    public function markAllRead(Request $request): RedirectResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return back();
    }
}
