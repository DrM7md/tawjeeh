<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// تذكير آلي يومي بالمراجعة الشهرية لخطط التحسين المتأخّرة (خريطة التطوير §1.3)
Schedule::command('improvement:remind-reviews')->dailyAt('07:00');
