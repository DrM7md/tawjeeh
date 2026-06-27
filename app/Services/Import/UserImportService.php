<?php

namespace App\Services\Import;

use App\Models\Department;
use App\Models\ImportBatch;
use App\Models\Role;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * استيراد الموجّهين من Excel وإنشاء حسابات دخول لهم.
 * التمييز ومنع التكرار عبر «البريد الإلكتروني» (فريد) — فإن تطابق بريد، يُحدَّث السجل.
 * الجديد يُنشأ بدور «موجه» نشط بكلمة المرور الافتراضية.
 */
class UserImportService
{
    use ReadsSpreadsheet;

    public const DEFAULT_PASSWORD = 'tawjeeh@1234';

    private const ALIASES = [
        'name' => ['الاسم', 'اسم الموجه', 'الموجه'],
        'email' => ['البريد الإلكتروني', 'البريد', 'الإيميل'],
        'phone' => ['رقم الهاتف', 'الهاتف'],
        'department' => ['القسم', 'المادة'],
        'gender' => ['النوع', 'الجنس'],
    ];

    /** @return list<array<string,string>> */
    public function parse(string $path): array
    {
        return $this->readRows($path, self::ALIASES);
    }

    public function preview(array $rows): array
    {
        $summary = ['new' => 0, 'update' => 0, 'error' => 0];
        $preview = [];

        foreach ($rows as $i => $row) {
            $analysis = $this->analyze($row);
            $summary[$analysis['status']]++;
            $preview[] = [
                'row' => $i + 1,
                'name' => $row['name'] ?? '',
                'email' => $row['email'] ?? '',
                'phone' => $row['phone'] ?? '',
                'department' => $row['department'] ?? '',
                'gender' => $this->genderLabel($row['gender'] ?? ''),
                'status' => $analysis['status'],
                'message' => $analysis['message'],
            ];
        }

        return ['rows' => $preview, 'summary' => $summary, 'total' => count($rows)];
    }

    public function import(array $rows, string $filename, ?int $userId): ImportBatch
    {
        $departments = Department::pluck('id', 'name');
        $supervisorRoleId = Role::where('name', Permissions::ROLE_SUPERVISOR)->value('id');

        $batch = ImportBatch::create([
            'user_id' => $userId,
            'type' => 'users',
            'original_filename' => $filename,
            'status' => 'processing',
            'total_rows' => count($rows),
        ]);

        $imported = 0;
        $updated = 0;
        $failed = 0;
        $errors = [];

        DB::transaction(function () use ($rows, $departments, $supervisorRoleId, $batch, &$imported, &$updated, &$failed, &$errors) {
            foreach ($rows as $i => $row) {
                $analysis = $this->analyze($row);
                if ($analysis['status'] === 'error') {
                    $failed++;
                    $errors[] = ['import_batch_id' => $batch->id, 'row_number' => $i + 1, 'message' => $analysis['message'], 'raw_data' => $row];

                    continue;
                }

                $departmentId = $row['department'] !== '' ? ($departments[$row['department']] ?? null) : null;
                $this->upsertUser($row, $departmentId, $supervisorRoleId) === 'created' ? $imported++ : $updated++;
            }

            if (! empty($errors)) {
                $batch->errors()->createMany($errors);
            }
        });

        $batch->update([
            'status' => 'completed',
            'imported_rows' => $imported,
            'updated_rows' => $updated,
            'failed_rows' => $failed,
            'summary' => ['imported' => $imported, 'updated' => $updated, 'failed' => $failed],
        ]);

        return $batch->fresh('errors');
    }

    /** إنشاء مستخدم أو تحديثه (مطابقة بالبريد). @return 'created'|'updated' */
    private function upsertUser(array $row, ?int $departmentId, ?int $supervisorRoleId): string
    {
        $gender = $this->normalizeGender($row['gender'] ?? '');
        $user = User::where('email', $row['email'])->first();

        if ($user) {
            $changes = [
                'name' => $row['name'],
                'phone' => $row['phone'] ?: null,
                'department_id' => $departmentId,
            ];
            if ($gender !== null) {
                $changes['gender'] = $gender; // لا نمسح النوع الموجود إن تُرك فارغًا
            }
            $user->update($changes);
            if ($supervisorRoleId) {
                $user->roles()->syncWithoutDetaching([$supervisorRoleId]);
            }

            return 'updated';
        }

        $user = User::create([
            'name' => $row['name'],
            'email' => $row['email'],
            'phone' => $row['phone'] ?: null,
            'department_id' => $departmentId,
            'gender' => $gender,
            'is_active' => true,
            'password' => Hash::make(self::DEFAULT_PASSWORD),
        ]);
        if ($supervisorRoleId) {
            $user->roles()->sync([$supervisorRoleId]);
        }

        return 'created';
    }

    /** يحوّل قيمة النوع (عربي/إنجليزي) إلى male/female، أو null إن كانت فارغة/غير معروفة. */
    private function normalizeGender(string $raw): ?string
    {
        return match (trim($raw)) {
            'ذكر', 'male', 'M', 'm' => 'male',
            'أنثى', 'انثى', 'female', 'F', 'f' => 'female',
            default => null,
        };
    }

    /** تسمية عربية للنوع لعرضها في معاينة الاستيراد. */
    private function genderLabel(string $raw): string
    {
        return match ($this->normalizeGender($raw)) {
            'male' => 'ذكر',
            'female' => 'أنثى',
            default => '',
        };
    }

    private function analyze(array $row): array
    {
        if (($row['name'] ?? '') === '') {
            return ['status' => 'error', 'message' => 'الاسم مطلوب'];
        }

        $email = $row['email'] ?? '';
        if ($email === '') {
            return ['status' => 'error', 'message' => 'البريد الإلكتروني مطلوب'];
        }
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => 'error', 'message' => 'صيغة البريد الإلكتروني غير صحيحة: '.$email];
        }

        if (($row['department'] ?? '') !== '' && ! Department::where('name', $row['department'])->exists()) {
            return ['status' => 'error', 'message' => 'القسم غير موجود: '.$row['department']];
        }

        $gender = $row['gender'] ?? '';
        if (trim($gender) !== '' && $this->normalizeGender($gender) === null) {
            return ['status' => 'error', 'message' => 'النوع غير صحيح (اكتب: ذكر أو أنثى): '.$gender];
        }

        if (User::where('email', $email)->exists()) {
            return ['status' => 'update', 'message' => 'تحديث مستخدم موجود (مطابقة بالبريد)'];
        }

        return ['status' => 'new', 'message' => 'موجّه جديد'];
    }
}
