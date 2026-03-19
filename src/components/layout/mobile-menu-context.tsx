"use client";

import { createContext, useContext } from "react";

interface MobileMenuContextValue {
  openMenu: () => void;
  isImpersonating: boolean;
}

export const MobileMenuContext = createContext<MobileMenuContextValue>({
  openMenu: () => {},
  isImpersonating: false,
});

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}
