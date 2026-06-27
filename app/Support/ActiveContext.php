<?php

namespace App\Support;

use App\Models\AcademicYear;
use App\Models\Semester;
use Illuminate\Support\Collection;

/**
 * السياق الأكاديمي الفعّال/المختار (Active Context).
 * - "النشط" (active): العام/الفصل الذي is_active=true — وجهة الإنشاء (AY-2/SM-3).
 * - "المختار" (selected): اختيار المستخدم من المحدّد العلوي — وجهة العرض/الفلترة (AY-5).
 *   يُخزّن في الجلسة ويعود افتراضيًا إلى النشط.
 *
 * المرجع: Brain/01-ARCHITECTURE.md §5 + Brain/05-BUSINESS-RULES.md (A/B)
 */
class ActiveContext
{
    private ?AcademicYear $activeYear = null;
    private bool $activeYearLoaded = false;
    private ?Semester $activeSemester = null;
    private bool $activeSemesterLoaded = false;

    /* ===================== النشط ===================== */

    public function activeYear(): ?AcademicYear
    {
        if (! $this->activeYearLoaded) {
            $this->activeYear = AcademicYear::where('is_active', true)->first();
            $this->activeYearLoaded = true;
        }

        return $this->activeYear;
    }

    public function activeSemester(): ?Semester
    {
        if (! $this->activeSemesterLoaded) {
            $year = $this->activeYear();
            $this->activeSemester = $year
                ? Semester::where('academic_year_id', $year->id)->where('is_active', true)->first()
                : null;
            $this->activeSemesterLoaded = true;
        }

        return $this->activeSemester;
    }

    public function activeYearId(): ?int
    {
        return $this->activeYear()?->id;
    }

    public function activeSemesterId(): ?int
    {
        return $this->activeSemester()?->id;
    }

    /* ===================== المختار ===================== */

    public function selectedYearId(): ?int
    {
        $sessionId = session('context.year_id');
        if ($sessionId && AcademicYear::whereKey($sessionId)->exists()) {
            return (int) $sessionId;
        }

        return $this->activeYearId();
    }

    public function selectedSemesterId(): ?int
    {
        $yearId = $this->selectedYearId();
        if (! $yearId) {
            return null;
        }

        $sessionId = session('context.semester_id');
        if ($sessionId && Semester::whereKey($sessionId)->where('academic_year_id', $yearId)->exists()) {
            return (int) $sessionId;
        }

        // افتراضي: الفصل النشط ضمن العام المختار، وإلا أوّل فصل.
        return Semester::where('academic_year_id', $yearId)
            ->orderByDesc('is_active')
            ->orderBy('id')
            ->value('id');
    }

    public function selectedYear(): ?AcademicYear
    {
        $id = $this->selectedYearId();

        return $id ? AcademicYear::find($id) : null;
    }

    public function selectedSemester(): ?Semester
    {
        $id = $this->selectedSemesterId();

        return $id ? Semester::find($id) : null;
    }

    /** هل العام المختار قابل للتعديل؟ فقط العام الفعّال — تُمنع الكتابة خلاف ذلك. */
    public function isEditable(): bool
    {
        return (bool) $this->selectedYear()?->is_active;
    }

    /* ===================== ضبط الاختيار ===================== */

    public function setYear(?int $yearId): void
    {
        session(['context.year_id' => $yearId]);
        session()->forget('context.semester_id'); // أعد ضبط الفصل عند تغيير العام
    }

    public function setSemester(?int $semesterId): void
    {
        session(['context.semester_id' => $semesterId]);
    }

    /* ===================== المشاركة مع الواجهة ===================== */

    /** @return array<string, mixed> */
    public function share(): array
    {
        $years = AcademicYear::orderByDesc('start_date')->orderByDesc('id')->get(['id', 'name', 'is_active']);
        $selectedYearId = $this->selectedYearId();

        /** @var Collection<int, Semester> $semesters */
        $semesters = $selectedYearId
            ? Semester::where('academic_year_id', $selectedYearId)->orderBy('id')->get(['id', 'name', 'is_active', 'academic_year_id'])
            : collect();

        return [
            'years' => $years,
            'semesters' => $semesters,
            'selectedYearId' => $selectedYearId,
            'selectedSemesterId' => $this->selectedSemesterId(),
            'activeYearId' => $this->activeYearId(),
            'activeSemesterId' => $this->activeSemesterId(),
            'isEditable' => $this->isEditable(),
        ];
    }
}
