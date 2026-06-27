<?php

namespace App\Http\Controllers;

use App\Models\NotificationSetting;
use App\Models\Role;
use App\Notifications\NotificationType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationSettingController extends Controller
{
    /** صفحة ضبط أنواع الإشعارات. */
    public function index(): Response
    {
        return Inertia::render('notification-settings/index', [
            'settings' => NotificationSetting::resolved(),
            'roles' => Role::orderBy('level')->get(['id', 'name', 'display_name']),
        ]);
    }

    /** حفظ ضبط الأنواع دفعةً واحدة. */
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*.type' => ['required', 'string'],
            'settings.*.enabled' => ['required', 'boolean'],
            'settings.*.recipient_roles' => ['array'],
            'settings.*.recipient_roles.*' => ['string'],
            'settings.*.department_scoped' => ['required', 'boolean'],
            'settings.*.live' => ['required', 'boolean'],
        ]);

        $validTypes = NotificationType::keys();

        foreach ($data['settings'] as $row) {
            if (! in_array($row['type'], $validTypes, true)) {
                continue;
            }

            NotificationSetting::updateOrCreate(
                ['type' => $row['type']],
                [
                    'enabled' => $row['enabled'],
                    'recipient_roles' => array_values($row['recipient_roles'] ?? []),
                    'department_scoped' => $row['department_scoped'],
                    'live' => $row['live'],
                ],
            );
        }

        return back()->with('success', 'تم حفظ إعدادات الإشعارات');
    }
}
