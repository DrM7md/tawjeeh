<?php

namespace App\Exports;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/** تصدير كشف المستخدمين (مع الأقسام والأدوار والحالة). */
class UsersDataExport extends FormalExport
{
    /** @param Collection<int,\App\Models\User> $users */
    public function __construct(private readonly Collection $users) {}

    protected function reportTitle(): string
    {
        return 'كشف المستخدمين';
    }

    protected function subtitle(): string
    {
        return 'تاريخ الإصدار: '.now()->format('Y-m-d');
    }

    protected function columns(): array
    {
        return ['م', 'الاسم', 'البريد الإلكتروني', 'رقم الهاتف', 'القسم', 'النوع', 'الأدوار', 'الحالة', 'آخر دخول'];
    }

    protected function rows(): array
    {
        $genderLabels = ['male' => 'ذكر', 'female' => 'أنثى'];

        return $this->users->values()->map(function ($u, $i) use ($genderLabels) {
            return [
                $i + 1,
                $u->name,
                $u->email,
                $u->phone ?: '—',
                $u->department?->name ?: 'إدارة التوجيه',
                $genderLabels[$u->gender] ?? '—',
                $u->roles->pluck('display_name')->implode('، ') ?: '—',
                $u->is_active ? 'نشط' : 'معطّل',
                $u->last_login_at ? Carbon::parse($u->last_login_at)->format('Y-m-d H:i') : '—',
            ];
        })->all();
    }

    public function columnWidths(): array
    {
        return ['A' => 6, 'B' => 28, 'C' => 28, 'D' => 16, 'E' => 20, 'F' => 10, 'G' => 30, 'H' => 10, 'I' => 18];
    }
}
