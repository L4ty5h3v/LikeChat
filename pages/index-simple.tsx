// Упрощенная версия главной страницы для диагностики
import { useState } from 'react';
import Layout from '@/components/Layout';

export default function HomeSimple() {
  const [mounted, setMounted] = useState(false);

  if (typeof window !== 'undefined' && !mounted) {
    setMounted(true);
  }

  return (
    <Layout title="MULTI LIKE - Test">
      <div style={{ padding: '20px', fontFamily: 'Arial' }}>
        <h1>Simplified Home Page</h1>
        <p>If you see this, basic rendering works!</p>
        <p>Time: {new Date().toLocaleString()}</p>
      </div>
    </Layout>
  );
}
