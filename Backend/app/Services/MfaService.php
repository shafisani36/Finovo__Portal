<?php

namespace App\Services;

use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class MfaService
{
    protected Google2FA $google2fa;

    public function __construct()
    {
        $this->google2fa = new Google2FA();
    }

    public function generateSecret(): string
    {
        return $this->google2fa->generateSecretKey(32);
    }

    public function getQrCodeUrl(string $companyOrAppName, string $email, string $secret): string
    {
        return $this->google2fa->getQRCodeUrl(
            $companyOrAppName,
            $email,
            $secret
        );
    }

    public function verifyCode(string $secret, string $code): bool
    {
        return (bool) $this->google2fa->verifyKey($secret, $code, 2);
    }

    public function generateRecoveryCodes(int $count = 8): array
    {
        $plainCodes = [];
        $hashedCodes = [];

        for ($i = 0; $i < $count; $i++) {
            $code = strtoupper(Str::random(4) . '-' . Str::random(4));
            $plainCodes[] = $code;
            $hashedCodes[] = hash('sha256', $code);
        }

        return [
            'plain' => $plainCodes,
            'hashed' => $hashedCodes,
        ];
    }

    public function verifyRecoveryCode(array $hashedCodes, string $inputCode): ?array
    {
        $cleanInput = strtoupper(trim($inputCode));
        $inputHash = hash('sha256', $cleanInput);

        $index = array_search($inputHash, $hashedCodes, true);
        if ($index !== false) {
            unset($hashedCodes[$index]);
            return array_values($hashedCodes); // Return remaining codes
        }

        return null;
    }
}
