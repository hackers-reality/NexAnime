import SkeletonCard from './SkeletonCard';

export default function SkeletonGrid({ count = 12, horizontal = true }: { count?: number; horizontal?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexDirection: horizontal ? 'row' : 'row',
        flexWrap: horizontal ? 'nowrap' : 'wrap',
        justifyContent: horizontal ? 'flex-start' : 'center',
        padding: horizontal ? '0 0 8px 0' : '16px 0',
        overflow: horizontal ? 'auto' : 'visible',
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ flex: horizontal ? '0 0 180px' : '0 0 165px' }}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}
