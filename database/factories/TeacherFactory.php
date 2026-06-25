<?php

namespace Database\Factories;

use App\Models\Department;
use App\Models\School;
use App\Models\Teacher;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Teacher>
 */
class TeacherFactory extends Factory
{
    protected $model = Teacher::class;

    public function definition(): array
    {
        return [
            'school_id' => School::factory(),
            'department_id' => fn () => Department::query()->value('id') ?? Department::create(['name' => 'قسم اختبار'])->id,
            'name' => 'معلم '.$this->faker->unique()->numerify('###'),
            'sections_count' => $this->faker->numberBetween(1, 6),
        ];
    }
}
