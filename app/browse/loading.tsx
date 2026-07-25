import SkeletonGrid from '@/components/shared/SkeletonGrid';

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      <div style={{ padding: '80px 24px 24px' }}>
        <div style={{
          height: 40,
          width: 200,
          borderRadius: 8,
          background: 'linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-surface-hover) 50%, var(--bg-surface) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
          marginBottom: 24,
        }} />
        <div style={{
          height: 48,
          borderRadius: 8,
          background: 'linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-surface-hover) 50%, var(--bg-surface) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
          marginBottom: 24,
        }} />
        <SkeletonGrid count={12} />
      </div>
    </div>
  );
}
