<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * ضبط كل نوع إشعار: تفعيله، الأدوار المستلِمة، حصره بنطاق القسم، والبث اللحظي.
     */
    public function up(): void
    {
        Schema::create('notification_settings', function (Blueprint $table) {
            $table->id();
            $table->string('type')->unique();       // مفتاح نوع الإشعار (NotificationType)
            $table->boolean('enabled')->default(true);
            $table->json('recipient_roles');        // أسماء الأدوار التي تستلم هذا الإشعار
            $table->boolean('department_scoped')->default(true); // يصل فقط لمن في قسم الحدث
            $table->boolean('live')->default(false); // بث لحظي (WebSockets) إضافةً للحفظ بقاعدة البيانات
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_settings');
    }
};
