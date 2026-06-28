import { SVGAttributes } from 'react';

// أيقونة بوصلة تعبّر عن "التوجيه" — هوية المنصة (بديلة لشعار Laravel)
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5 22.5 17.799 22.5 12 17.799 1.5 12 1.5Zm0 1.8a8.7 8.7 0 1 0 0 17.4 8.7 8.7 0 0 0 0-17.4Z"
            />
            <path d="M16.86 7.14a.6.6 0 0 1 .79.79l-2.2 5.5a2.4 2.4 0 0 1-1.34 1.34l-5.5 2.2a.6.6 0 0 1-.79-.79l2.2-5.5a2.4 2.4 0 0 1 1.34-1.34l5.5-2.2Zm-4.86 3.66a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z" />
        </svg>
    );
}
