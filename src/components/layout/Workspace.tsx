import { ReactNode } from 'react';

interface WorkspaceProps {
  children: ReactNode;
}

export function Workspace({ children }: WorkspaceProps) {
  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-hidden">
      {children}
    </div>
  );
}
