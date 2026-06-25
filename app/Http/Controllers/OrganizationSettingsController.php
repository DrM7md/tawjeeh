<?php

namespace App\Http\Controllers;

use App\Models\Stage;
use App\Models\TeacherClassification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * إعدادات الهيكل: المراحل الدراسية + تصنيفات المعلمين (CRUD مبسّط).
 * محميّة بصلاحية settings.manage.
 */
class OrganizationSettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('organization/settings/index', [
            'stages' => Stage::orderBy('sort_order')->get(),
            'classifications' => TeacherClassification::orderBy('required_visits', 'desc')->get(),
        ]);
    }

    // ---------- المراحل ----------
    public function storeStage(Request $request): RedirectResponse
    {
        $data = $this->validateStage($request);
        $data['code'] = 'stage_'.bin2hex(random_bytes(4)); // معرّف يُولَّد تلقائيًا
        Stage::create($data);

        return back()->with('success', 'تم إضافة المرحلة');
    }

    public function updateStage(Request $request, Stage $stage): RedirectResponse
    {
        $stage->update($this->validateStage($request));

        return back()->with('success', 'تم تحديث المرحلة');
    }

    public function destroyStage(Stage $stage): RedirectResponse
    {
        $stage->delete();

        return back()->with('success', 'تم حذف المرحلة');
    }

    private function validateStage(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
    }

    // ---------- التصنيفات ----------
    public function storeClassification(Request $request): RedirectResponse
    {
        $data = $this->validateClassification($request);
        $data['code'] = 'class_'.bin2hex(random_bytes(4)); // معرّف يُولَّد تلقائيًا
        TeacherClassification::create($data);

        return back()->with('success', 'تم إضافة التصنيف');
    }

    public function updateClassification(Request $request, TeacherClassification $classification): RedirectResponse
    {
        $classification->update($this->validateClassification($request));

        return back()->with('success', 'تم تحديث التصنيف');
    }

    public function destroyClassification(TeacherClassification $classification): RedirectResponse
    {
        $classification->delete();

        return back()->with('success', 'تم حذف التصنيف');
    }

    private function validateClassification(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'required_visits' => ['required', 'integer', 'min:1', 'max:10'],
            'color' => ['nullable', 'string', 'max:30'],
        ]);
    }
}
