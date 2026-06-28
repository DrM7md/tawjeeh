import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff, LoaderCircle, Lock, Mail } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

interface LoginForm {
    email: string;
    password: string;
    remember: boolean;
}

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        email: '',
        password: '',
        remember: false,
    });
    const [showPassword, setShowPassword] = useState(false);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout title="تسجيل الدخول" description="أدخل بريدك الإلكتروني وكلمة المرور للدخول إلى حسابك">
            <Head title="تسجيل الدخول" />

            {status && (
                <div className="border-success/30 bg-success/10 text-success mb-6 rounded-lg border px-4 py-3 text-center text-sm font-medium">
                    {status}
                </div>
            )}

            <form className="flex flex-col gap-5" onSubmit={submit}>
                <div className="grid gap-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <div className="relative">
                        <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                        <Input
                            id="email"
                            type="email"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="example@email.com"
                            dir="ltr"
                            className="h-11 pr-10 text-left"
                        />
                    </div>
                    <InputError message={errors.email} />
                </div>

                <div className="grid gap-2">
                    <div className="flex items-center">
                        <Label htmlFor="password">كلمة المرور</Label>
                        {canResetPassword && (
                            <TextLink href={route('password.request')} className="mr-auto text-sm" tabIndex={5}>
                                نسيت كلمة المرور؟
                            </TextLink>
                        )}
                    </div>
                    <div className="relative">
                        <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            tabIndex={2}
                            autoComplete="current-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="••••••••"
                            dir="ltr"
                            className="h-11 px-10 text-left"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                            className="text-muted-foreground hover:text-foreground absolute top-1/2 left-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
                        >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                    </div>
                    <InputError message={errors.password} />
                </div>

                <div className="flex items-center gap-3">
                    <Checkbox
                        id="remember"
                        name="remember"
                        tabIndex={3}
                        checked={data.remember}
                        onCheckedChange={(v) => setData('remember', v === true)}
                    />
                    <Label htmlFor="remember" className="cursor-pointer font-normal">
                        تذكّرني على هذا الجهاز
                    </Label>
                </div>

                <Button type="submit" className="mt-2 h-11 w-full text-base" tabIndex={4} disabled={processing}>
                    {processing && <LoaderCircle className="size-4 animate-spin" />}
                    تسجيل الدخول
                </Button>
            </form>
        </AuthLayout>
    );
}
