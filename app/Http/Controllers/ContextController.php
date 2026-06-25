<?php

namespace App\Http\Controllers;

use App\Support\ActiveContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * تبديل العام/الفصل المختار من المحدّد العلوي. متاح لكل مستخدم مصادَق.
 */
class ContextController extends Controller
{
    public function update(Request $request, ActiveContext $context): RedirectResponse
    {
        $data = $request->validate([
            'year_id' => ['nullable', 'exists:academic_years,id'],
            'semester_id' => ['nullable', 'exists:semesters,id'],
        ]);

        if (array_key_exists('year_id', $data)) {
            $context->setYear($data['year_id'] ? (int) $data['year_id'] : null);
        }

        if (! empty($data['semester_id'])) {
            $context->setSemester((int) $data['semester_id']);
        }

        return back();
    }
}
