<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToAcademicContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * تقييم ملفات/حافظة أعمال المنسق وفق قالب بنود مرنة. مرتبط بالعام والفصل المختار.
 */
class PortfolioReview extends Model
{
    use Auditable, BelongsToAcademicContext;

    // مرتبط بالعام فقط لا بالفصل: تقييما الفصلين (term) يظهران معًا في تابات.
    // الـ semester_id يُشتقّ من الفصل عند الإنشاء للتقارير فقط.
    protected bool $usesSemester = false;

    protected $fillable = [
        'academic_year_id', 'semester_id', 'teacher_id', 'supervisor_id',
        'department_id', 'portfolio_review_template_id', 'term', 'total_score', 'result',
        'status', 'reviewed_at', 'notes',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'date', 'total_score' => 'decimal:2'];
    }

    // المنسق المُقيَّم = معلم له تكليف تنسيق. نسميها coordinator() للوضوح الدلالي في الواجهة.
    public function coordinator(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'teacher_id');
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(PortfolioReviewTemplate::class, 'portfolio_review_template_id');
    }

    public function scores(): HasMany
    {
        return $this->hasMany(PortfolioReviewScore::class)->orderBy('sort_order');
    }

    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isSuper() || $user->hasPermission('portfolios.view.all')) {
            return $query;
        }
        if ($user->hasPermission('portfolios.view.department') && $user->department_id) {
            return $query->where('department_id', $user->department_id);
        }

        return $query->where('supervisor_id', $user->id);
    }
}
