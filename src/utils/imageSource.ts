export function imageSource(imageId: string): string {
  return `jellypilot-image://localhost/${encodeURIComponent(imageId)}`;
}
