import { createContext, createSignal, useContext } from 'solid-js';
import type { JSX } from 'solid-js';

export interface LibraryNavbarControlsApi {
  portalTarget: () => HTMLDivElement | null;
  setPortalTarget: (el: HTMLDivElement | null) => void;
}

export const LibraryNavbarControlsContext = createContext<LibraryNavbarControlsApi>();
export function useLibraryNavbarControls(): LibraryNavbarControlsApi {
  const context = useContext(LibraryNavbarControlsContext);

  if (!context) {
    throw new Error('Library navbar controls are only available under the Library route');
  }

  return context;
}

export function LibraryNavbarControlsProvider(props: { children: JSX.Element }) {
  const [portalTarget, setPortalTarget] = createSignal<HTMLDivElement | null>(null);

  const api: LibraryNavbarControlsApi = {
    portalTarget,
    setPortalTarget: (el) => setPortalTarget(el),
  };

  return (
    <LibraryNavbarControlsContext.Provider value={api}>
      {props.children}
    </LibraryNavbarControlsContext.Provider>
  );
}
