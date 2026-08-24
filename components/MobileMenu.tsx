'use client';

import {
  type ReactNode,
  useRef,
} from 'react';

type MobileMenuProps = {
  children: ReactNode;
};

export function MobileMenu({
  children,
}: MobileMenuProps) {
  const detailsRef =
    useRef<HTMLDetailsElement>(null);

  function handleNavigation(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const target =
      event.target as HTMLElement;

    if (target.closest('a')) {
      detailsRef.current?.removeAttribute(
        'open',
      );
    }
  }

  return (
    <details
      ref={detailsRef}
      className="mobileMenu"
    >
      <summary
        className="mobileMenuButton"
        aria-label="Open navigation menu"
      >
        <span aria-hidden="true">☰</span>
        <span className="mobileMenuLabel">
          Menu
        </span>
      </summary>

      <div
        className="mobileMenuPanel"
        onClick={handleNavigation}
      >
        {children}
      </div>
    </details>
  );
}