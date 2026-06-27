<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * تمييز نوع الدفعة (مدارس/معلمين) وربطها بالمدرسة/القسم عند الحاجة.
     */
    public function up(): void
    {
        Schema::table('import_batches', function (Blueprint $table) {
            $table->string('type')->default('schools')->after('user_id'); // schools | teachers
            $table->foreignId('school_id')->nullable()->after('type')->constrained('schools')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->after('school_id')->constrained('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('import_batches', function (Blueprint $table) {
            $table->dropForeign(['school_id']);
            $table->dropForeign(['department_id']);
            $table->dropColumn(['type', 'school_id', 'department_id']);
        });
    }
};
