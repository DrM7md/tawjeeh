import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
    const { appearance } = useAppearance();

    return (
        <Sonner
            theme={appearance as ToasterProps['theme']}
            className="toaster group"
            dir="rtl"
            position="top-center"
            toastOptions={{
                classNames: {
                    toast: 'group toast group-[.toaster]:glass-strong group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-luxe group-[.toaster]:rounded-[18px]',
                    description: 'group-[.toast]:text-muted-foreground',
                    actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                    cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                },
                style: { width: '380px' },
            }}
            {...props}
        />
    );
};

export { Toaster };
