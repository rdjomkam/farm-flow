"use client";

import { createContext, useContext } from "react";

interface MobileMenuContextValue {
  openMenu: () => void;
}

export const MobileMenuContext = createContext<MobileMenuContextValue>({
  openMenu: () => {},
});

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}
