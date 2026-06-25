<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_forms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_id')->unique()->constrained('visits')->cascadeOnDelete();
            $table->json('school_snapshot')->nullable();
            $table->json('target_snapshot')->nullable();
            $table->json('axes')->nullable();          // محاور التقييم ودرجاتها
            $table->text('notes')->nullable();
            $table->text('recommendations')->nullable();
            $table->text('signature')->nullable();      // توقيع إلكتروني
            $table->enum('save_status', ['draft', 'final'])->default('draft');
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_forms');
    }
};
