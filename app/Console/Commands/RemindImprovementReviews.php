<?php

namespace App\Console\Commands;

use App\Models\ImprovementPlan;
use App\Models\NotificationSetting;
use App\Notifications\DomainNotification;
use App\Notifications\NotificationType;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

/**
 * تذكير آلي: يُرسل للموجّه إشعارًا عند تأخّر المراجعة الشهرية لخطة تحسين نشطة.
 * يُجدوَل يوميًا (routes/console.php). المرجع: خريطة التطوير §1.3
 */
class RemindImprovementReviews extends Command
{
    protected $signature = 'improvement:remind-reviews {--days=30 : عدد الأيام قبل اعتبار المراجعة متأخّرة}';

    protected $description = 'تذكير الموجّهين بالمراجعة الشهرية لخطط التحسين النشطة المتأخّرة';

    public function handle(): int
    {
        $config = NotificationSetting::for(NotificationType::IMPROVEMENT_REVIEW_DUE);
        if ($config === null || ! $config['enabled']) {
            $this->info('نوع الإشعار معطّل — لا تذكير.');

            return self::SUCCESS;
        }

        $dueDays = max(1, (int) $this->option('days'));
        $today = now();
        $sent = 0;

        ImprovementPlan::where('status', 'active')
            ->with(['supervisor:id,name,is_active', 'target:id,name'])
            ->withMax('reviews', 'review_date')
            ->chunkById(100, function ($plans) use (&$sent, $dueDays, $today, $config) {
                foreach ($plans as $plan) {
                    // مرجع الاستحقاق: آخر مراجعة، وإلا بداية الخطة، وإلا تاريخ الإنشاء
                    $reference = $plan->reviews_max_review_date
                        ? Carbon::parse($plan->reviews_max_review_date)
                        : ($plan->start_date ?? $plan->created_at);

                    if ($reference->diffInDays($today) < $dueDays) {
                        continue; // المراجعة حديثة
                    }
                    // لا تُكرّر التذكير أكثر من مرة كل 7 أيام
                    if ($plan->last_reminded_at && $plan->last_reminded_at->diffInDays($today) < 7) {
                        continue;
                    }

                    $supervisor = $plan->supervisor;
                    if (! $supervisor || ! $supervisor->is_active) {
                        continue;
                    }

                    $name = $plan->target?->name ?? 'المستهدف';
                    Notification::send($supervisor, new DomainNotification(
                        typeKey: NotificationType::IMPROVEMENT_REVIEW_DUE,
                        title: 'مراجعة خطة تحسين مستحقّة',
                        message: "خطة تحسين «{$name}» تجاوزت {$dueDays} يومًا دون مراجعة — سجّل المراجعة الشهرية.",
                        url: route('improvement.show', $plan),
                        icon: 'review',
                        live: (bool) $config['live'],
                    ));

                    $plan->forceFill(['last_reminded_at' => $today])->saveQuietly();
                    $sent++;
                }
            });

        $this->info("تم إرسال {$sent} تذكيرًا.");

        return self::SUCCESS;
    }
}
