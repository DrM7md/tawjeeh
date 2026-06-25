<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(Request $request): Response
    {
        $logs = AuditLog::with('user:id,name')
            ->when($request->input('action'), fn ($q, $a) => $q->where('action', $a))
            ->latest('created_at')
            ->latest('id')
            ->paginate(30)
            ->withQueryString()
            ->through(fn (AuditLog $log) => [
                'id' => $log->id,
                'user' => $log->user?->name ?? 'النظام',
                'action' => $log->action,
                'type' => class_basename($log->auditable_type ?? ''),
                'auditable_id' => $log->auditable_id,
                'ip' => $log->ip_address,
                'created_at' => $log->created_at?->format('Y-m-d H:i'),
            ]);

        return Inertia::render('audit/index', [
            'logs' => $logs,
            'filterAction' => $request->input('action'),
        ]);
    }
}
