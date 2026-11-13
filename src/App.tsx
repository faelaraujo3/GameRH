import React from 'react';
import { useGameSync } from './hooks/useGameSync';
import { ParticipantMobileView } from './views/ParticipantMobileView';
import { AdminNotebookView } from './views/AdminNotebookView';
import { ScoreboardDesktopView } from './views/ScoreboardDesktopView';

export const App: React.FC = () => {
  const { snapshot, connected, displayRemainingSeconds, applySnapshot } = useGameSync();
  const pathname = window.location.pathname.toLowerCase();

  if (pathname.startsWith('/admin')) {
    return (
      <AdminNotebookView
        snapshot={snapshot}
        connected={connected}
        displayRemainingSeconds={displayRemainingSeconds}
        applySnapshot={applySnapshot}
      />
    );
  }

  if (pathname.startsWith('/placar')) {
    return (
      <ScoreboardDesktopView
        snapshot={snapshot}
        connected={connected}
        displayRemainingSeconds={displayRemainingSeconds}
      />
    );
  }

  return (
    <ParticipantMobileView
      snapshot={snapshot}
      connected={connected}
      displayRemainingSeconds={displayRemainingSeconds}
      applySnapshot={applySnapshot}
    />
  );
};

export default App;
