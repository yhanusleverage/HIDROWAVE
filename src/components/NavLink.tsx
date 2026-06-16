'use client';

import React from 'react';
import Link from 'next/link';
import { useNavigationPending } from '@/contexts/NavigationPendingContext';

type NavLinkProps = React.ComponentProps<typeof Link>;

export default function NavLink({ onClick, ...props }: NavLinkProps) {
  const { setPending } = useNavigationPending();

  return (
    <Link
      {...props}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          onClick?.(event);
          return;
        }
        const target = event.currentTarget.getAttribute('target');
        if (target && target !== '_self') {
          onClick?.(event);
          return;
        }
        setPending(true);
        onClick?.(event);
      }}
    />
  );
}
