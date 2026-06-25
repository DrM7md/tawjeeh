<?php

namespace Tests\Feature\Import;

use App\Models\Coordinator;
use App\Models\ImportBatch;
use App\Models\Role;
use App\Models\School;
use App\Models\Teacher;
use App\Models\User;
use App\Services\ImportService;
use App\Support\Permissions;
use Database\Seeders\ReferenceDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ImportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ReferenceDataSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->roles()->sync([Role::where('name', Permissions::ROLE_HEAD)->first()->id]);
    }

    private function makeCsv(array $rows): string
    {
        $header = "المدرسة,المرحلة,المادة,المنسق,المعلم,التصنيف,عدد الشعب\n";
        $body = collect($rows)->map(fn ($r) => implode(',', $r))->implode("\n");
        $path = tempnam(sys_get_temp_dir(), 'imp').'.csv';
        file_put_contents($path, "\xEF\xBB\xBF".$header.$body);

        return $path;
    }

    public function test_parse_reads_and_maps_columns(): void
    {
        $path = $this->makeCsv([
            ['مدرسة الأمل', 'إعدادي', 'الرياضيات', 'أحمد', 'خالد', 'متميز', '4'],
        ]);

        $rows = app(ImportService::class)->parse($path);

        $this->assertCount(1, $rows);
        $this->assertSame('مدرسة الأمل', $rows[0]['school']);
        $this->assertSame('الرياضيات', $rows[0]['department']);
        $this->assertSame('خالد', $rows[0]['teacher']);
        $this->assertSame('4', $rows[0]['sections']);
    }

    public function test_preview_flags_new_and_error_rows(): void
    {
        $path = $this->makeCsv([
            ['مدرسة الأمل', 'إعدادي', 'الرياضيات', 'أحمد', 'خالد', 'متميز', '4'],
            ['مدرسة بلا مادة', 'إعدادي', 'مادة وهمية', '', 'طالب', '', '2'],
        ]);
        $service = app(ImportService::class);

        $preview = $service->preview($service->parse($path));

        $this->assertSame(2, $preview['total']);
        $this->assertSame(1, $preview['summary']['new']);
        $this->assertSame(1, $preview['summary']['error']);
    }

    public function test_import_creates_entities_and_records_batch(): void
    {
        $path = $this->makeCsv([
            ['مدرسة الأمل', 'إعدادي', 'الرياضيات', 'أحمد', 'خالد', 'متميز', '4'],
            ['مدرسة النور', 'ثانوي', 'العلوم', 'سعاد', 'منى', 'يحتاج دعم', '5'],
            ['مدرسة بلا مادة', 'إعدادي', 'مادة وهمية', '', 'طالب', '', '2'],
        ]);
        $service = app(ImportService::class);

        $batch = $service->import($service->parse($path), 'test.csv', $this->admin->id);

        $this->assertSame('completed', $batch->status);
        $this->assertSame(2, $batch->imported_rows);
        $this->assertSame(1, $batch->failed_rows);
        $this->assertSame(2, Teacher::count());
        $this->assertSame(2, Coordinator::count());
        $this->assertSame(2, School::count());
        $this->assertSame(1, $batch->errors()->count());
    }

    public function test_reimport_updates_instead_of_duplicating(): void
    {
        $rows = [['مدرسة الأمل', 'إعدادي', 'الرياضيات', 'أحمد', 'خالد', 'متميز', '4']];
        $service = app(ImportService::class);

        $service->import($service->parse($this->makeCsv($rows)), 'a.csv', $this->admin->id);
        // إعادة الاستيراد بعدد شعب مختلف
        $rows[0][6] = '7';
        $batch2 = $service->import($service->parse($this->makeCsv($rows)), 'b.csv', $this->admin->id);

        $this->assertSame(0, $batch2->imported_rows);
        $this->assertSame(1, $batch2->updated_rows);
        $this->assertSame(1, Teacher::count());
        $this->assertSame(7, Teacher::first()->sections_count);
    }

    public function test_import_page_renders(): void
    {
        $this->actingAs($this->admin)
            ->get('/import')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('import/index')->has('batches'));
    }

    public function test_user_without_permission_cannot_preview(): void
    {
        // رئيس قسم لديه import.run؟ نعم. لذا نستخدم دورًا بلا الصلاحية: ننشئ دورًا فارغًا.
        $role = Role::create(['name' => 'no_import', 'display_name' => 'بلا استيراد', 'level' => 3, 'permissions' => ['import.view'], 'is_system' => false]);
        $user = User::factory()->create();
        $user->roles()->sync([$role->id]);

        $this->actingAs($user)
            ->post('/import/preview', ['file' => UploadedFile::fake()->create('x.xlsx', 10)])
            ->assertForbidden();
    }
}
