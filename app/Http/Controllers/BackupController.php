<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    public function index(): Response
    {
        Storage::makeDirectory('backups');
        $files = collect(Storage::files('backups'))
            ->filter(fn ($f) => str_ends_with($f, '.sql'))
            ->map(fn ($f) => [
                'name' => basename($f),
                'size' => round(Storage::size($f) / 1024, 1),
                'date' => date('Y-m-d H:i', Storage::lastModified($f)),
            ])
            ->sortByDesc('date')
            ->values();

        return Inertia::render('backup/index', ['backups' => $files]);
    }

    public function run(): RedirectResponse
    {
        $code = Artisan::call('tawjeeh:backup');

        return $code === 0
            ? back()->with('success', 'تم إنشاء نسخة احتياطية')
            : back()->with('error', 'تعذّر إنشاء النسخة الاحتياطية (تأكد من توفّر mysqldump)');
    }

    public function download(string $name): StreamedResponse
    {
        $path = 'backups/'.basename($name);
        abort_unless(Storage::exists($path), 404);

        return Storage::download($path);
    }

    public function destroy(string $name): RedirectResponse
    {
        Storage::delete('backups/'.basename($name));

        return back()->with('success', 'تم حذف النسخة');
    }
}
