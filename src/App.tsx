import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

function App() {
  const [status, setStatus] = useState<string>('Đang kiểm tra kết nối Supabase...');
  const [rolesCount, setRolesCount] = useState<number | null>(null);

  useEffect(() => {
    async function checkConnection() {
      try {
        // Thử truy vấn bảng roles vừa tạo
        const { data, error } = await supabase.from('roles').select('id, name');
        if (error) {
          setStatus('Kết nối Supabase thất bại: ' + error.message);
        } else {
          setStatus('Kết nối Supabase thành công!');
          setRolesCount(data?.length || 0);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setStatus('Lỗi hệ thống: ' + errorMessage);
      }
    }

    checkConnection();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h1>Sales Hub - Control Center v1.0</h1>
      <div style={{
        padding: '1rem',
        borderRadius: '8px',
        backgroundColor: status.includes('thành công') ? '#e6f4ea' : '#fce8e6',
        color: status.includes('thành công') ? '#137333' : '#c5221f',
        marginTop: '1rem'
      }}>
        <p><strong>Trạng thái:</strong> {status}</p>
        {rolesCount !== null && (
          <p>Số vai trò hệ thống đã tải: <strong>{rolesCount}</strong> (ADMIN, STORE_MANAGER, STAFF)</p>
        )}
      </div>
    </div>
  );
}

export default App;