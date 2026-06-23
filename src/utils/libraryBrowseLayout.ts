export const LIBRARY_BROWSE_MIN_CARD_WIDTH_PX = 160;
export const LIBRARY_BROWSE_GRID_GAP_PX = 12;
export const LIBRARY_BROWSE_AUTO_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3';

export function libraryBrowseColumnCount(width: number): number {
  if (!Number.isFinite(width) || width <= 0) {
    return 1;
  }

  return Math.max(
    1,
    Math.floor(
      (width + LIBRARY_BROWSE_GRID_GAP_PX) /
        (LIBRARY_BROWSE_MIN_CARD_WIDTH_PX + LIBRARY_BROWSE_GRID_GAP_PX),
    ),
  );
}
