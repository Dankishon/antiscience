import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type BaseButtonProps = {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type LinkButtonProps = BaseButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'> & {
    external?: boolean;
    href: string;
  };

type NativeButtonProps = BaseButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & {
    external?: never;
    href?: undefined;
  };

export type ButtonProps = LinkButtonProps | NativeButtonProps;

function isLinkButtonProps(props: ButtonProps): props is LinkButtonProps {
  return typeof props.href === 'string';
}

export function Button(props: ButtonProps) {
  if (isLinkButtonProps(props)) {
    const {
      children,
      className,
      external = false,
      fullWidth = false,
      href,
      size = 'md',
      variant = 'primary',
      ...linkProps
    } = props;
    const classes = cn(
      'button',
      `button--${variant}`,
      `button--${size}`,
      fullWidth && 'button--fullWidth',
      className,
    );

    if (external) {
      return (
        <a className={classes} href={href} {...linkProps}>
          {children}
        </a>
      );
    }

    return (
      <Link className={classes} href={href} {...linkProps}>
        {children}
      </Link>
    );
  }

  const {
    children,
    className,
    fullWidth = false,
    size = 'md',
    type = 'button',
      variant = 'primary',
      ...buttonProps
    } = props;
  const classes = cn(
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth && 'button--fullWidth',
    className,
  );

  return (
    <button className={classes} type={type} {...buttonProps}>
      {children}
    </button>
  );
}
