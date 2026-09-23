import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [rolesCount, setRolesCount] = useState<number | null>(null);

  // 1. Kiểm tra session hiện tại và đếm role
  useEffect(() => {
    // Lấy thông tin user đăng nhập (nếu đã lưu session trước đó)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Lắng nghe thay đổi trạng thái đăng nhập/đăng xuất
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Tải số lượng role
    supabase.from('roles').select('id', { count: 'exact' }).then(({ count, error }) => {
      if (!error && count !== null) setRolesCount(count);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Xử lý Đăng ký / Đăng nhập
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isRegister) {
        // Đăng ký tài khoản mới
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName } // Lưu tên vào user_meta_data để trigger tự điền vào profiles
          }
        });
        if (error) throw error;
        setMessage('Đăng ký thành công! Hãy kiểm tra email kích hoạt hoặc tiến hành đăng nhập.');
      } else {
        // Đăng nhập
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        setMessage('Đăng nhập thành công!');
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      setMessage('Lỗi: ' + errMessage);
    } finally {
      setLoading(false);
    }
  };

  // 3. Xử lý Đăng xuất
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMessage('Đã đăng xuất.');
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '480px', margin: 'auto' }}>
      <h2>Sales Hub - Control Center v1.0</h2>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Hệ thống: Kết nối Database OK | Số vai trò: <strong>{rolesCount ?? '...'}</strong>
      </p>

      <hr style={{ margin: '1.5rem 0', borderColor: '#eee' }} />

      {user ? (
        // Giao diện khi ĐÃ ĐĂNG NHẬP
        <div style={{ background: '#e6f4ea', padding: '1.5rem', borderRadius: '8px', color: '#137333' }}>
          <h3>Xin chào, {user.email}!</h3>
          <p>Mã User ID: <code>{user.id}</code></p>
          <button
            onClick={handleSignOut}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#d93025',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Đăng xuất
          </button>
        </div>
      ) : (
        // Giao diện FORM ĐĂNG NHẬP / ĐĂNG KÝ
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>{isRegister ? 'Đăng ký tài khoản nội bộ' : 'Đăng nhập Sales Hub'}</h3>

          {isRegister && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem' }}>Họ và Tên:</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
                placeholder="Nguyễn Văn A"
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Email:</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              placeholder="admin@saleshub.local"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Mật khẩu:</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem',
              backgroundColor: '#1a73e8',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Đang xử lý...' : (isRegister ? 'Tạo tài khoản' : 'Đăng nhập')}
          </button>

          <p style={{ fontSize: '0.9rem', textAlign: 'center' }}>
            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <span
              onClick={() => { setIsRegister(!isRegister); setMessage(''); }}
              style={{ color: '#1a73e8', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegister ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
            </span>
          </p>
        </form>
      )}

      {message && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          borderRadius: '4px',
          backgroundColor: message.startsWith('Lỗi') ? '#fce8e6' : '#e8f0fe',
          color: message.startsWith('Lỗi') ? '#c5221f' : '#1a73e8'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default App;