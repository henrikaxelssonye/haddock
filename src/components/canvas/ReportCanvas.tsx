import { useCanvasStore } from '../../stores';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasTableWrapper } from './CanvasTableWrapper';

export function ReportCanvas() {
  const objects = useCanvasStore((s) => s.objects);

  return (
    <div className="flex flex-col h-full">
      <CanvasToolbar />
      <div
        className="flex-1 relative overflow-auto"
        style={{
          backgroundImage:
            'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {objects.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-400">
              <p className="text-lg font-medium">Empty canvas</p>
              <p className="text-sm mt-1">
                Add tables using the toolbar above or click tables in the sidebar
              </p>
            </div>
          </div>
        )}
        {objects.map((obj) => (
          <CanvasTableWrapper key={obj.id} obj={obj} />
        ))}
      </div>
    </div>
  );
}
