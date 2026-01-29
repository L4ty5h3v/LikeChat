// Простой тест для проверки загрузки JavaScript
export default function Test() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>JavaScript Test</h1>
      <p>If you see this, JavaScript is working!</p>
      <p>Time: {new Date().toLocaleString()}</p>
    </div>
  );
}
