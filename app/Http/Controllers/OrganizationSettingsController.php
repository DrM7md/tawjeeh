<?php

namespace App\Http\Controllers;

use App\Models\Grade;
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
            'grades' => Grade::with(['stage:id,name', 'tracks:id,grade_id,name,sort_order'])->orderBy('sort_order')->get(),
        ]);
    }

    // ---------- المراحل ----------
    public function storeStage(Request $request): RedirectResponse
    {
        $data = $this->validateStage($request);
        $data['code'] = 'stage_'.bin2hex(random_bytes(4)); // معرّف يُولَّد تلقائيًا
        $data['sort_order'] = (int) Stage::max('sort_order') + 1; // ترتيب تلقائي (append)
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
            'required_forms' => ['required', 'integer', 'min:0', 'max:10'],
            'min_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'max_percent' => ['nullable', 'integer', 'min:0', 'max:100', 'gte:min_percent'],
            'is_default_for_new' => ['boolean'],
            'color' => ['nullable', 'string', 'max:30'],
        ]);
    }

    // ---------- الصفوف الدراسية ----------
    public function storeGrade(Request $request): RedirectResponse
    {
        $data = $this->validateGrade($request);
        $grade = Grade::create([
            'name' => $data['name'],
            'stage_id' => $data['stage_id'] ?? null,
            'sort_order' => (int) Grade::max('sort_order') + 1, // ترتيب تلقائي (append)
        ]);
        $this->syncTracks($grade, $data['tracks'] ?? []);

        return back()->with('success', 'تم إضافة الصف');
    }

    public function updateGrade(Request $request, Grade $grade): RedirectResponse
    {
        $data = $this->validateGrade($request);
        $grade->update([
            'name' => $data['name'],
            'stage_id' => $data['stage_id'] ?? null,
        ]); // الترتيب يبقى كما هو
        $this->syncTracks($grade, $data['tracks'] ?? []);

        return back()->with('success', 'تم تحديث الصف');
    }

    public function destroyGrade(Grade $grade): RedirectResponse
    {
        $grade->delete();

        return back()->with('success', 'تم حذف الصف');
    }

    private function validateGrade(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'stage_id' => ['nullable', 'exists:stages,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'tracks' => ['nullable', 'array'],
            'tracks.*' => ['nullable', 'string', 'max:255'],
        ]);
    }

    /** مزامنة مسارات الصف من قائمة أسماء (يحذف ما لم يَعُد موجودًا). */
    private function syncTracks(Grade $grade, array $tracks): void
    {
        $names = collect($tracks)->map(fn ($t) => trim((string) $t))->filter()->values();

        $grade->tracks()->whereNotIn('name', $names)->delete();

        $names->each(function (string $name, int $i) use ($grade) {
            $grade->tracks()->updateOrCreate(['name' => $name], ['sort_order' => $i + 1]);
        });
    }
}
