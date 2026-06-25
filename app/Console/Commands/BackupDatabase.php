<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

/**
 * نسخة احتياطية لقاعدة البيانات عبر mysqldump إلى storage/app/backups.
 * يمكن جدولتها في routes/console.php.
 */
class BackupDatabase extends Command
{
    protected $signature = 'tawjeeh:backup';

    protected $description = 'إنشاء نسخة احتياطية لقاعدة البيانات';

    public function handle(): int
    {
        $db = config('database.connections.mysql');
        Storage::makeDirectory('backups');
        $file = storage_path('app/backups/backup_'.now()->format('Ymd_His').'.sql');

        $process = Process::fromShellCommandline(
            sprintf(
                'mysqldump --host=%s --port=%s --user=%s %s %s > %s',
                $db['host'], $db['port'], $db['username'],
                $db['password'] ? '--password='.$db['password'] : '',
                $db['database'], escapeshellarg($file)
            )
        );
        $process->setTimeout(300);
        $process->run();

        if (! $process->isSuccessful()) {
            $this->error('فشل النسخ الاحتياطي: '.$process->getErrorOutput());

            return self::FAILURE;
        }

        $this->info('تم إنشاء النسخة الاحتياطية: '.basename($file));

        return self::SUCCESS;
    }
}
