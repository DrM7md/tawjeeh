<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(ReferenceDataSeeder::class);

        // مستخدم رئيس التوجيه (admin)
        $admin = User::updateOrCreate(
            ['email' => 'admin@tawjeeh.test'],
            [
                'name' => 'رئيس التوجيه',
                'password' => Hash::make('password'),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        $headRole = Role::where('name', Permissions::ROLE_HEAD)->first();
        if ($headRole) {
            $admin->roles()->syncWithoutDetaching([$headRole->id]);
        }
    }
}
