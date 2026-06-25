<?php

namespace App\Services;

use App\Models\Visit;
use App\Models\VisitForm;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * استمارة الزيارة: مسودة/اعتماد نهائي + المرفقات. القواعد: VF في Brain/05-BUSINESS-RULES.md.
 */
class VisitFormService
{
    public function save(Visit $visit, array $data, string $status): VisitForm
    {
        $form = $visit->form;

        $payload = [
            'axes' => $data['axes'] ?? [],
            'notes' => $data['notes'] ?? null,
            'recommendations' => $data['recommendations'] ?? null,
            'signature' => $data['signature'] ?? null,
            'save_status' => $status,
            'finalized_at' => $status === 'final' ? now() : null,
        ];

        if (! $form) {
            $payload['visit_id'] = $visit->id;
            $payload['school_snapshot'] = $visit->school?->only(['id', 'name', 'code']);
            $payload['target_snapshot'] = ['name' => $visit->visitable?->name];
            $form = VisitForm::create($payload);
        } else {
            $form->update($payload);
        }

        return $form->fresh('files');
    }

    public function addFile(VisitForm $form, UploadedFile $file): void
    {
        $path = $file->store('visit-files', 'local'); // تخزين خاص (غير عام)

        $form->files()->create([
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);
    }

    public function deleteFile(\App\Models\VisitFile $file): void
    {
        Storage::disk('local')->delete($file->path);
        $file->delete();
    }
}
