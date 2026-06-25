<?php

namespace App\Services;

use App\Models\TestReview;
use App\Models\TestReviewForm;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * تحكيم الاختبارات. القواعد: TR في Brain/05-BUSINESS-RULES.md.
 */
class TestReviewService
{
    public function list(User $user): Collection
    {
        return TestReview::query()
            ->visibleTo($user)
            ->with(['school:id,name', 'department:id,name', 'stage:id,name', 'supervisor:id,name', 'form:id,test_review_id,total_score'])
            ->latest('reviewed_at')
            ->latest('id')
            ->get();
    }

    public function create(array $data): TestReview
    {
        return TestReview::create([
            'supervisor_id' => auth()->id(),
            'school_id' => $data['school_id'],
            'department_id' => $data['department_id'],
            'stage_id' => $data['stage_id'] ?? null,
            'grade' => $data['grade'] ?? null,
            'status' => 'draft',
            'reviewed_at' => $data['reviewed_at'] ?? now()->toDateString(),
        ]);
    }

    public function saveForm(TestReview $review, array $data, string $status): TestReviewForm
    {
        $criteria = $data['criteria'] ?? [];
        $total = array_sum(array_map('floatval', array_values($criteria)));

        $form = TestReviewForm::updateOrCreate(
            ['test_review_id' => $review->id],
            [
                'criteria' => $criteria,
                'total_score' => $total,
                'notes' => $data['notes'] ?? null,
                'result' => $data['result'] ?? null,
            ],
        );

        $review->update(['status' => $status]);

        return $form;
    }

    public function delete(TestReview $review): void
    {
        $review->delete();
    }
}
