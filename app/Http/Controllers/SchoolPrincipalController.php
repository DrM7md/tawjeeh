<?php

namespace App\Http\Controllers;

use App\Models\Scopes\AcademicContextScope;
use App\Models\SchoolPrincipal;
use Inertia\Inertia;
use Inertia\Response;

/** سجل مدراء المدارس عبر الأعوام — عرض محميّ بصلاحية settings.manage. */
class SchoolPrincipalController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('organization/principals/index', [
            'principals' => SchoolPrincipal::withoutGlobalScope(AcademicContextScope::class)
                ->with(['school:id,name', 'academicYear:id,name'])
                ->orderBy('school_id')
                ->orderByDesc('academic_year_id')
                ->get()
                ->map(fn (SchoolPrincipal $p) => [
                    'id' => $p->id,
                    'school' => $p->school?->name ?? '—',
                    'year' => $p->academicYear?->name ?? '—',
                    'name' => $p->name,
                ]),
        ]);
    }
}
