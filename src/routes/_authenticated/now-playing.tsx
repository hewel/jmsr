import { createFileRoute } from '@tanstack/solid-router';
import NowPlayingCard from '../../components/NowPlayingCard';

export const Route = createFileRoute('/_authenticated/now-playing')({
  component: () => <NowPlayingCard jellyfinConnected={true} />,
});
