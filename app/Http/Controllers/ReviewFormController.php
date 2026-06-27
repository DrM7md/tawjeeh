<?php

namespace App\Http\Controllers;

use App\Models\ReviewDomain;
use App\Models\ReviewIndicator;
use App\Models\ReviewItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * تحرير استمارة تحكيم الاختبارات: المجال ← البنود ← المؤشرات.
 * محميّة بصلاحية settings.manage.
 */
class ReviewFormController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('organization/review-form/index', [
            'domains' => ReviewDomain::with('items.indicators')->orderBy('sort_order')->get(),
        ]);
    }

    /* ===================== المجالات ===================== */

    public function storeDomain(Request $request): RedirectResponse
    {
        $data = $this->validateDomain($request);
        ReviewDomain::create([
            'name' => $data['name'],
            'kind' => $data['kind'] ?? 'rating',
            'sort_order' => (int) ReviewDomain::max('sort_order') + 1,
        ]);

        return back()->with('success', 'تم إضافة المجال');
    }

    public function updateDomain(Request $request, ReviewDomain $domain): RedirectResponse
    {
        $domain->update($this->validateDomain($request));

        return back()->with('success', 'تم تحديث المجال');
    }

    public function destroyDomain(ReviewDomain $domain): RedirectResponse
    {
        $domain->delete();

        return back()->with('success', 'تم حذف المجال');
    }

    private function validateDomain(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'kind' => ['nullable', Rule::in(['rating', 'approval'])],
        ]);
    }

    /* ===================== البنود ===================== */

    public function storeItem(Request $request, ReviewDomain $domain): RedirectResponse
    {
        $data = $this->validateItem($request);
        $domain->items()->create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'sort_order' => (int) $domain->items()->max('sort_order') + 1,
        ]);

        return back()->with('success', 'تم إضافة البند');
    }

    public function updateItem(Request $request, ReviewItem $item): RedirectResponse
    {
        $item->update($this->validateItem($request));

        return back()->with('success', 'تم تحديث البند');
    }

    public function destroyItem(ReviewItem $item): RedirectResponse
    {
        $item->delete();

        return back()->with('success', 'تم حذف البند');
    }

    private function validateItem(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    /* ===================== المؤشرات ===================== */

    public function storeIndicator(Request $request, ReviewItem $item): RedirectResponse
    {
        $data = $this->validateIndicator($request);
        $item->indicators()->create([
            'label' => $data['label'],
            'weight' => $data['weight'] ?? 0,
            'sort_order' => (int) $item->indicators()->max('sort_order') + 1,
        ]);

        return back()->with('success', 'تم إضافة المؤشّر');
    }

    public function updateIndicator(Request $request, ReviewIndicator $indicator): RedirectResponse
    {
        $indicator->update($this->validateIndicator($request));

        return back()->with('success', 'تم تحديث المؤشّر');
    }

    public function destroyIndicator(ReviewIndicator $indicator): RedirectResponse
    {
        $indicator->delete();

        return back()->with('success', 'تم حذف المؤشّر');
    }

    private function validateIndicator(Request $request): array
    {
        return $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'weight' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);
    }
}
