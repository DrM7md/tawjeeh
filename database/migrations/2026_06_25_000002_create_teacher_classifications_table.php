<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_classifications', function (Blueprint $table) {
            $table->id();
            $table->string('name');                              // يحتاج دعم / متوسط / متميز
            $table->string('code')->unique();                    // needs_support / average / distinguished
            $table->unsignedTinyInteger('required_visits')->default(1);
            $table->string('color')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_classifications');
    }
};
