<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portfolio_review_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portfolio_review_id')->constrained('portfolio_reviews')->cascadeOnDelete();
            // البند الأصلي للمرجع؛ يُترك فارغًا إن حُذف البند من القالب (النص محفوظ لقطةً أدناه)
            $table->foreignId('portfolio_review_item_id')->nullable()->constrained('portfolio_review_items')->nullOnDelete();
            $table->string('criterion_text', 1000);  // لقطة من نص البند وقت التقييم
            $table->unsignedSmallInteger('max_score')->default(5);
            $table->unsignedSmallInteger('score')->nullable();
            $table->text('note')->nullable();
            // مرفق (دليل/شاهد) واحد لكل بند — تخزين خاص
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portfolio_review_scores');
    }
};
