<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\VisitDomain;
use App\Models\VisitFollowUpType;
use App\Models\VisitNotePreset;
use App\Models\VisitStandard;
use App\Models\VisitStandardRecommendation;
use App\Models\VisitTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * إدارة قوالب استمارات الإشراف: القالب ← المجالات ← المعايير ← التوصيات،
 * وربط الأقسام (المواد) بالقالب، والنصوص الجاهزة. محميّة بـ settings.manage.
 */
class VisitTemplateController extends Controller
{
    public function index(): Response
    {
        $templates = VisitTemplate::query()
            ->withCount(['domains', 'visits'])
            ->with('departments:id,name')
            ->orderBy('name')
            ->get();

        // عدد المعايير لكل قالب (عبر المجالات)
        $standardsCount = VisitStandard::query()
            ->selectRaw('visit_domains.visit_template_id as tid, COUNT(*) as c')
            ->join('visit_domains', 'visit_domains.id', '=', 'visit_standards.visit_domain_id')
            ->groupBy('visit_domains.visit_template_id')
            ->pluck('c', 'tid');
        $templates->each(fn (VisitTemplate $t) => $t->setAttribute('standards_count', (int) ($standardsCount[$t->id] ?? 0)));

        return Inertia::render('organization/supervision-templates/index', [
            'templates' => $templates,
            'notePresets' => VisitNotePreset::orderBy('sort_order')->get(['id', 'text']),
            'followUpTypes' => VisitFollowUpType::orderBy('sort_order')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateTemplate($request);
        $data['created_by'] = $request->user()->id;
        VisitTemplate::create($data);

        return back()->with('success', 'تم إنشاء القالب');
    }

    public function update(Request $request, VisitTemplate $template): RedirectResponse
    {
        $template->update($this->validateTemplate($request));

        return back()->with('success', 'تم تحديث القالب');
    }

    public function destroy(VisitTemplate $template): RedirectResponse
    {
        abort_if($template->visits()->exists(), 422, 'لا يمكن حذف قالب استُخدم في زيارات');
        $template->delete();

        return back()->with('success', 'تم حذف القالب');
    }

    public function show(VisitTemplate $template): Response
    {
        $template->load(['domains.standards.recommendations', 'departments:id,name']);

        $linkedIds = $template->departments->pluck('id');
        $available = Department::whereNotIn('id', $linkedIds)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('organization/supervision-templates/show', [
            'template' => $template,
            'availableDepartments' => $available,
        ]);
    }

    /* ===================== ربط الأقسام ===================== */

    public function linkDepartment(Request $request, VisitTemplate $template): RedirectResponse
    {
        $data = $request->validate(['department_id' => ['required', 'exists:departments,id']]);
        // قسم واحد ↔ قالب واحد: ينقل الربط إن كان مرتبطًا بقالب آخر.
        Department::whereKey($data['department_id'])->first()?->visitTemplates()->sync([$template->id]);

        return back()->with('success', 'تم ربط القسم بالقالب');
    }

    public function unlinkDepartment(VisitTemplate $template, Department $department): RedirectResponse
    {
        $template->departments()->detach($department->id);

        return back()->with('success', 'تم فك ربط القسم');
    }

    /* ===================== المجالات ===================== */

    public function storeDomain(Request $request, VisitTemplate $template): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);
        $template->domains()->create([
            'name' => $data['name'],
            'sort_order' => (int) $template->domains()->max('sort_order') + 1,
        ]);

        return back()->with('success', 'تم إضافة المجال');
    }

    public function updateDomain(Request $request, VisitDomain $domain): RedirectResponse
    {
        $domain->update($request->validate(['name' => ['required', 'string', 'max:255']]));

        return back()->with('success', 'تم تحديث المجال');
    }

    public function destroyDomain(VisitDomain $domain): RedirectResponse
    {
        $domain->delete();

        return back()->with('success', 'تم حذف المجال');
    }

    /* ===================== المعايير ===================== */

    public function storeStandard(Request $request, VisitDomain $domain): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:1000']]);
        $domain->standards()->create([
            'name' => $data['name'],
            'sort_order' => (int) $domain->standards()->max('sort_order') + 1,
        ]);

        return back()->with('success', 'تم إضافة المعيار');
    }

    public function updateStandard(Request $request, VisitStandard $standard): RedirectResponse
    {
        $standard->update($request->validate(['name' => ['required', 'string', 'max:1000']]));

        return back()->with('success', 'تم تحديث المعيار');
    }

    public function destroyStandard(VisitStandard $standard): RedirectResponse
    {
        $standard->delete();

        return back()->with('success', 'تم حذف المعيار');
    }

    /* ===================== التوصيات الجاهزة لكل معيار ===================== */

    public function storeRecommendation(Request $request, VisitStandard $standard): RedirectResponse
    {
        $data = $request->validate(['text' => ['required', 'string', 'max:1000']]);
        $standard->recommendations()->create([
            'text' => $data['text'],
            'sort_order' => (int) $standard->recommendations()->max('sort_order') + 1,
        ]);

        return back()->with('success', 'تم إضافة التوصية');
    }

    public function destroyRecommendation(VisitStandardRecommendation $recommendation): RedirectResponse
    {
        $recommendation->delete();

        return back()->with('success', 'تم حذف التوصية');
    }

    /* ===================== النصوص الجاهزة العامة ===================== */

    public function saveNotePresets(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'notes' => ['array'],
            'notes.*' => ['nullable', 'string', 'max:1000'],
        ]);

        $texts = collect($data['notes'] ?? [])->map(fn ($t) => trim((string) $t))->filter()->values();

        VisitNotePreset::query()->delete();
        $texts->each(fn (string $text, int $i) => VisitNotePreset::create(['text' => $text, 'sort_order' => $i + 1]));

        return back()->with('success', 'تم حفظ النصوص الجاهزة');
    }

    public function saveFollowUpTypes(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'types' => ['array'],
            'types.*' => ['nullable', 'string', 'max:100'],
        ]);

        $names = collect($data['types'] ?? [])->map(fn ($t) => trim((string) $t))->filter()->unique()->values();

        VisitFollowUpType::query()->delete();
        $names->each(fn (string $name, int $i) => VisitFollowUpType::create(['name' => $name, 'sort_order' => $i + 1]));

        return back()->with('success', 'تم حفظ أنواع المتابعة');
    }

    private function validateTemplate(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ]);
    }
}
