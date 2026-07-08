import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  }
>;

export function Button({
  children,
  className,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const buttonClassName =
    variant === 'primary'
      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-500/90'
      : 'bg-slate-200 text-ink-950 hover:bg-slate-300';

  return (
    <button
      type={type}
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center rounded-full px-4 py-3 font-bold transition duration-150 ease-out hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
