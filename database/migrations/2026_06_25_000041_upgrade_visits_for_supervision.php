<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ترقية الزيارات لنظام الإشراف بالمعايير:
 * - حقول إضافية على الزيارة (القالب/الشعبة/الدرس/نوع المتابعة/رقم الزيارة/النسبة).
 * - جدول درجات المعايير (0–4) + توصية لكل معيار.
 * - جدول متابعة تنفيذ التوصيات لكل مجال.
 * - استبدال محاور الاستمارة القديمة (axes) بالنظام الجديد.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->foreignId('template_id')->nullable()->after('department_id')
                ->constrained('visit_templates')->nullOnDelete();
            $table->string('section')->nullable()->after('visit_type');       // الشعبة الصفية
            $table->string('lesson_topic')->nullable()->after('section');     // موضوع الدرس
            $table->string('follow_up_type')->nullable()->after('lesson_topic'); // نوع المتابعة
            $table->unsignedInteger('visit_number')->nullable()->after('visit_date'); // ترتيب زيارة المعلم
            $table->decimal('overall_rating', 5, 2)->nullable()->after('visit_number'); // النسبة %
        });

        // درجات المعايير لكل زيارة (0 = غير مقيّم، 1..4 مستويات).
        Schema::create('visit_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->constrained('visits')->cascadeOnDelete();
            $table->foreignId('visit_standard_id')->constrained('visit_standards')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating_value')->default(0);
            $table->text('recommendation')->nullable();
            $table->timestamps();

            $table->unique(['visit_id', 'visit_standard_id']);
        });

        // متابعة تنفيذ توصيات كل مجال لاحقًا.
        Schema::create('visit_followups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->constrained('visits')->cascadeOnDelete();
            $table->foreignId('visit_domain_id')->constrained('visit_domains')->cascadeOnDelete();
            $table->enum('status', ['pending', 'full', 'mostly', 'partially', 'not_done'])->default('pending');
            $table->timestamps();

            $table->unique(['visit_id', 'visit_domain_id']);
        });

        // الاستمارة الجديدة تخزّن الملاحظات العامة + الحالة فقط؛ المحاور القديمة تُلغى.
        Schema::table('visit_forms', function (Blueprint $table) {
            if (Schema::hasColumn('visit_forms', 'axes')) {
                $table->dropColumn('axes');
            }
            $table->text('general_notes')->nullable()->after('target_snapshot');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_followups');
        Schema::dropIfExists('visit_ratings');

        Schema::table('visits', function (Blueprint $table) {
            $table->dropConstrainedForeignId('template_id');
            $table->dropColumn(['section', 'lesson_topic', 'follow_up_type', 'visit_number', 'overall_rating']);
        });

        Schema::table('visit_forms', function (Blueprint $table) {
            $table->json('axes')->nullable();
            $table->dropColumn('general_notes');
        });
    }
};
