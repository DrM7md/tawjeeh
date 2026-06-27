<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stage_id')->nullable()->constrained('stages')->nullOnDelete();
            $table->string('name');                         // الروضة / الأول ... الثاني عشر
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('stage_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grades');
    }
};
