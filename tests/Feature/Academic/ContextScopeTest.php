<?php

namespace Tests\Feature\Academic;

use App\Models\AcademicYear;
use App\Models\Concerns\BelongsToAcademicContext;
use App\Models\Semester;
use App\Support\ActiveContext;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\TestCase;

/** نموذج تجريبي يستخدم Trait السياق الأكاديمي. */
class ContextItem extends Model
{
    use BelongsToAcademicContext;

    protected $table = 'context_items';
    protected $guarded = [];
    public $timestamps = false;
}

class ContextScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ReferenceDataSeeder::class);

        Schema::create('context_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->nullable();
            $table->foreignId('semester_id')->nullable();
            $table->string('title');
        });
    }

    public function test_creating_fills_year_and_semester_from_active_context(): void
    {
        $context = app(ActiveContext::class);
        $item = ContextItem::create(['title' => 'بند']);

        $this->assertEquals($context->selectedYearId(), $item->academic_year_id);
        $this->assertEquals($context->selectedSemesterId(), $item->semester_id);
    }

    public function test_global_scope_filters_by_selected_year(): void
    {
        $year2 = AcademicYear::create(['name' => '2024–2025', 'is_active' => false]);
        $sem2 = Semester::create(['academic_year_id' => $year2->id, 'name' => 'الفصل الأول', 'is_active' => true]);

        // بند في العام النشط (افتراضي)
        ContextItem::create(['title' => 'حالي']);

        // بند في عام آخر (نتجاوز السياق صراحةً)
        ContextItem::create(['title' => 'قديم', 'academic_year_id' => $year2->id, 'semester_id' => $sem2->id]);

        // افتراضيًا نرى الحالي فقط
        $this->assertSame(1, ContextItem::count());
        $this->assertSame('حالي', ContextItem::first()->title);

        // بعد تبديل السياق للعام القديم نرى القديم فقط
        app(ActiveContext::class)->setYear($year2->id);
        // نسخة سياق جديدة لأن القديمة تُخزّن النشط مؤقتًا
        app()->forgetInstance(ActiveContext::class);
        $this->assertSame('قديم', ContextItem::first()->title);

        // وبدون فلترة نرى الكل
        $this->assertSame(2, ContextItem::withoutAcademicContext()->count());
    }
}
