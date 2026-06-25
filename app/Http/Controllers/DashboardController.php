<?php

namespace App\Http\Controllers;

use App\Services\IndicatorService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private readonly IndicatorService $service) {}

    public function index(Request $request): Response
    {
        return Inertia::render('dashboard', [
            'dashboard' => $this->service->dashboard($request->user()),
        ]);
    }
}
