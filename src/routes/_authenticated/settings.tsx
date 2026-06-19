import { createFileRoute, useNavigate } from '@tanstack/solid-router';

import OperationsConsole from '../../components/OperationsConsole';

function SettingsRoute() {
  const navigate = useNavigate();

  const handleSignedOut = () => {
    navigate({ to: '/login' });
  };

  return <OperationsConsole onSignedOut={handleSignedOut} />;
}

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsRoute,
});
