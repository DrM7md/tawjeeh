<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * أنواع أحداث التقويم — مرجع قابل للإدارة من إعدادات الهيكل (بدل enum ثابت).
 * has_time: هل يُظهر النوع حقول الوقت/المكان (مثل «اجتماع»).
 * يُستبدل عمود calendar_tasks.category بمفتاح أجنبي للنوع.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_event_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('color', 20)->nullable();
            $table->boolean('has_time')->default(false);   // يكشف حقول الوقت/المكان
            $table->boolean('is_default')->default(false);  // النوع المختار افتراضيًا في النموذج
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // الأنواع الافتراضية (تقابل enum القديم)
        $now = now();
        DB::table('calendar_event_types')->insert([
            ['name' => 'عام', 'color' => null, 'has_time' => false, 'is_default' => true, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'اجتماع', 'color' => '#0ea5e9', 'has_time' => true, 'is_default' => false, 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'إنجاز تقرير', 'color' => '#16a34a', 'has_time' => false, 'is_default' => false, 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
        ]);

        Schema::table('calendar_tasks', function (Blueprint $table) {
            $table->dropColumn('category');
            $table->foreignId('calendar_event_type_id')->nullable()->after('priority')
                ->constrained('calendar_event_types')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('calendar_tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('calendar_event_type_id');
            $table->enum('category', ['general', 'meeting', 'report'])->default('general')->after('priority');
        });

        Schema::dropIfExists('calendar_event_types');
    }
};
