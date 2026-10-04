# PROJECT_CONTROL_CENTER v1.0

## 1. NGUYÊN TẮC BẤT BIẾN (IMMUTABLE RULES)
- **Chiến lược chi phí**: FREE-FIRST (100% Zero Paid Infra). Tuyệt đối không dùng domain/server trả phí.
- **Kiến trúc mã nguồn**: Chia để trị (Feature-Driven Modularization). Tuyệt đối KHÔNG gom logic vào file App.tsx.
- **Giới hạn độ dài file**: Tối đa 250 - 300 dòng/file. Nếu dài hơn, bắt buộc phải tách component con hoặc custom hook.
- **Nguyên tắc làm việc với AI**: Mỗi lần chỉ xử lý duy nhất 1 trang hoặc 1 tính năng nhỏ (One-Feature-At-A-Time).
- **Tầng bảo mật**: Frontend chỉ để hiển thị. Row Level Security (RLS) tại Supabase là chốt chặn bảo mật cuối cùng.

## 2. STACK CÔNG NGHỆ CHUẨN
- **Frontend Core**: React 18+ (TypeScript), Vite.
- **Routing**: React Router DOM (Lazy loading).
- **Styling**: Tailwind CSS + Icon Lucide-react.
- **Backend / Database**: Supabase Free (PostgreSQL 15+, Supabase Auth, RLS).
- **Hosting / CI-CD**: GitHub Free + Netlify Free.