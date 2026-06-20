import { createContext, useContext } from 'solid-js';
import type { JSX } from 'solid-js';

export interface LibraryNavbarControlsApi {
  setControls: (controls: JSX.Element) => void;
  clearControls: () => void;
}

export const LibraryNavbarControlsContext = createContext<LibraryNavbarControlsApi>();

export function useLibraryNavbarControls(): LibraryNavbarControlsApi {
  const context = useContext(LibraryNavbarControlsContext);

  if (!context) {
    throw new Error('Library navbar controls are only available under the Library route');
  }

  return context;
}
