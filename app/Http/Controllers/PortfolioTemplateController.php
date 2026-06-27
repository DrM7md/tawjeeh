<?php

namespace App\Http\Controllers;

use App\Models\PortfolioReviewItem;
use App\Models\PortfolioReviewTemplate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * إدارة قوالب تقييم ملفات المنسق: القالب ← البنود (المعايير) القابلة للضبط بالكامل.
 * محميّة بصلاحية settings.manage.
 */
class PortfolioTemplateController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('organization/portfolio-templates/index', [
            'templates' => PortfolioReviewTemplate::query()
                ->with('items')
                ->withCount(['items', 'reviews'])
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateTemplate($request);
        $data['created_by'] = $request->user()->id;
        PortfolioReviewTemplate::create($data);

        return back()->with('success', 'تم إنشاء القالب');
    }

    public function update(Request $request, PortfolioReviewTemplate $template): RedirectResponse
    {
        $template->update($this->validateTemplate($request));

        return back()->with('success', 'تم تحديث القالب');
    }

    public function destroy(PortfolioReviewTemplate $template): RedirectResponse
    {
        abort_if($template->reviews()->exists(), 422, 'لا يمكن حذف قالب استُخدم في تقييمات');
        $template->delete();

        return back()->with('success', 'تم حذف القالب');
    }

    /* ===================== البنود (المعايير) ===================== */

    public function storeItem(Request $request, PortfolioReviewTemplate $template): RedirectResponse
    {
        $data = $this->validateItem($request);
        $template->items()->create([
            'criterion_text' => $data['criterion_text'],
            'max_score' => $data['max_score'],
            'sort_order' => (int) $template->items()->max('sort_order') + 1, // ترتيب تلقائي (append)
        ]);

        return back()->with('success', 'تم إضافة البند');
    }

    public function updateItem(Request $request, PortfolioReviewItem $item): RedirectResponse
    {
        $item->update($this->validateItem($request));

        return back()->with('success', 'تم تحديث البند');
    }

    public function destroyItem(PortfolioReviewItem $item): RedirectResponse
    {
        $item->delete();

        return back()->with('success', 'تم حذف البند');
    }

    private function validateTemplate(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ]);
    }

    private function validateItem(Request $request): array
    {
        return $request->validate([
            'criterion_text' => ['required', 'string', 'max:1000'],
            'max_score' => ['required', 'integer', 'min:1', 'max:100'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
    }
}
