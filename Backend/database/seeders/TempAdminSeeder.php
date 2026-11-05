<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class TempAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Delete any previous test admin (so you can run the seeder repeatedly)
        \App\Models\User::where('email', 'admin@test.local')->delete();

        // Create a new admin user (password: 123456)
        \App\Models\User::create([
            'name' => 'Temp Admin',
            'email' => 'admin@test.local',
            // Use Laravel's Hash facade for password hashing
            'password' => '123456',
            // If you have a role/permission column, uncomment and set it
            // 'role' => 'admin',
            // 'is_admin' => true,
        ]);

        $this->command->info('✅ Temporary admin user created (email: admin@test.local, password: 123456)');
    }
}
