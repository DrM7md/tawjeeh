<?php

namespace App\Http\Controllers;

use App\Services\StatisticsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StatisticsController extends Controller
{
    public function __construct(private readonly StatisticsService $service) {}

    public function schools(): Response
    {
        return Inertia::render('statistics/schools', ['stats' => $this->service->schools()]);
    }

    public function users(Request $request): Response
    {
        return Inertia::render('statistics/users', ['stats' => $this->service->users($request->user())]);
    }

    public function visits(Request $request): Response
    {
        return Inertia::render('statistics/visits', ['stats' => $this->service->visits($request->user())]);
    }

    public function reviews(Request $request): Response
    {
        return Inertia::render('statistics/reviews', ['stats' => $this->service->reviews($request->user())]);
    }
}
