import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ZoomProvider } from './shared/contexts/ZoomContext';
import { AuthProvider } from './shared/contexts/AuthContext';
import { PermissionProvider } from './shared/contexts/PermissionContext';
import MainLayout from './shared/components/layout/MainLayout';
import ProtectedRoute from './shared/components/layout/ProtectedRoute';
import UnauthorizedAccessView from './shared/components/layout/UnauthorizedAccessView';

const HomePage = lazy(() => import('./features/home/HomePage'));
const MonthlyReportPage = lazy(() => import('./features/monthly-report/MonthlyReportPage'));
const DailyReportPage = lazy(() => import('./features/daily-report/DailyReportPage'));
const DailyEmployeeRevenueReportPage = lazy(() => import('./features/daily-report/DailyEmployeeRevenueReportPage'));
const RevenueTrendPage = lazy(() => import('./features/revenue-trend/RevenueTrendPage'));
const DataUpdatePage = lazy(() => import('./features/data-update/DataUpdatePage'));
const DataManagerPage = lazy(() => import('./features/data-management/DataManagerPage'));
const EmployeeTargetUnifiedPage = lazy(() => import('./features/employee-health/EmployeeTargetUnifiedPage'));
const CampaignConfigPage = lazy(() => import('./features/admin-config/CampaignConfigPage'));
const StoreEmployeeConfigPage = lazy(() => import('./features/store-management/StoreEmployeeConfigPage'));
const EmployeeCumulativePage = lazy(() => import('./features/employee-cumulative/EmployeeCumulativePage'));
const EmployeePerformanceReportPage = lazy(() => import('./features/employee-performance/EmployeePerformanceReportPage'));
const EmployeeDetailReportPage = lazy(() => import('./features/employee-detail/EmployeeDetailReportPage'));
const EmployeeSessionManagerPage = lazy(() => import('./features/employee-cumulative/EmployeeSessionManagerPage'));
const CampaignSummaryPage = lazy(() => import('./features/campaign-summary/CampaignSummaryPage'));
const CampaignProgressPage = lazy(() => import('./features/campaign-progress/CampaignProgressPage'));
const SystemAdminPage = lazy(() => import('./features/admin-config/SystemAdminPage'));
const UserManagementPage = lazy(() => import('./features/admin-config/UserManagementPage'));
const UserStorePermissionPage = lazy(() => import('./features/admin-config/UserStorePermissionPage'));

// Các trang Định danh, Đăng ký & Onboarding
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const OnboardingPage = lazy(() => import('./features/auth/OnboardingPage'));
const PendingApprovalPage = lazy(() => import('./features/auth/PendingApprovalPage'));
const ResetPasswordCallbackPage = lazy(() => import('./features/auth/ResetPasswordCallbackPage'));

export default function App() {
    return (
        <AuthProvider>
            <PermissionProvider>
                <ZoomProvider>
                    <Suspense fallback={
                        <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-500 font-bold text-sm">
                            Đang nạp hệ thống Sales Hub...
                        </div>
                    }>
                        <Routes>
                            {/* Phân hệ Xác thực & Thiết lập Tài khoản (Ngoài MainLayout) */}
                            <Route path="/dang-nhap" element={<LoginPage />} />
                            <Route path="/dang-ky" element={<RegisterPage />} />
                            <Route path="/dat-lai-mat-khau" element={<ResetPasswordCallbackPage />} />
                            <Route path="/onboarding" element={<OnboardingPage />} />
                            <Route path="/cho-xet-duyet" element={<PendingApprovalPage />} />

                            <Route element={<MainLayout />}>
                                {/* Trang Chủ Hệ Thống (Yêu cầu đăng nhập) */}
                                <Route path="/" element={
                                    <ProtectedRoute path="/">
                                        <HomePage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/trang-chu" element={
                                    <ProtectedRoute path="/trang-chu">
                                        <HomePage />
                                    </ProtectedRoute>
                                } />

                                {/* Phân hệ BC Tháng */}
                                <Route path="/bc-thang" element={<Navigate to="/bc-thang/tong-quan" replace />} />
                                <Route path="/bc-thang/tong-quan" element={
                                    <ProtectedRoute path="/bc-thang/tong-quan">
                                        <MonthlyReportPage />
                                    </ProtectedRoute>
                                } />

                                {/* Phân hệ BC Ngày */}
                                <Route path="/bc-ngay" element={<Navigate to="/bc-ngay/tong-quan" replace />} />
                                <Route path="/bc-ngay/tong-quan" element={
                                    <ProtectedRoute path="/bc-ngay/tong-quan">
                                        <DailyReportPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/bc-ngay-nhan-vien" element={
                                    <ProtectedRoute path="/bc-ngay-nhan-vien">
                                        <DailyEmployeeRevenueReportPage />
                                    </ProtectedRoute>
                                } />

                                {/* Báo cáo Hiệu quả Lũy kế Doanh thu Nhân viên */}
                                <Route path="/bao-cao-hieu-qua-nhan-vien" element={
                                    <ProtectedRoute path="/bao-cao-hieu-qua-nhan-vien">
                                        <EmployeePerformanceReportPage />
                                    </ProtectedRoute>
                                } />

                                {/* Báo Cáo Chi Tiết Nhân Viên */}
                                <Route path="/chi-tiet-nhan-vien" element={
                                    <ProtectedRoute path="/chi-tiet-nhan-vien">
                                        <EmployeeDetailReportPage />
                                    </ProtectedRoute>
                                } />

                                {/* Báo Cáo Tổng Hợp Thi Đua Ngành Hàng */}
                                <Route path="/tong-hop-thi-dua" element={
                                    <ProtectedRoute path="/tong-hop-thi-dua">
                                        <CampaignSummaryPage />
                                    </ProtectedRoute>
                                } />

                                {/* Báo Cáo Tiến Độ Thi Đua Nhân Viên */}
                                <Route path="/tien-do-thi-dua" element={
                                    <ProtectedRoute path="/tien-do-thi-dua">
                                        <CampaignProgressPage />
                                    </ProtectedRoute>
                                } />

                                {/* Phân hệ Cập nhật & Quản lý */}
                                <Route path="/cap-nhat" element={
                                    <ProtectedRoute path="/cap-nhat">
                                        <DataUpdatePage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/cap-nhat-luy-ke-nhan-vien" element={
                                    <ProtectedRoute path="/cap-nhat-luy-ke-nhan-vien">
                                        <EmployeeCumulativePage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/quan-ly-du-lieu" element={
                                    <ProtectedRoute path="/quan-ly-du-lieu">
                                        <DataManagerPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/quan-ly-phien-nhan-vien" element={
                                    <ProtectedRoute path="/quan-ly-phien-nhan-vien">
                                        <EmployeeSessionManagerPage />
                                    </ProtectedRoute>
                                } />

                                {/* Phân hệ Sức khỏe NV & Admin */}
                                <Route path="/muc-tieu-nhan-vien" element={
                                    <ProtectedRoute path="/muc-tieu-nhan-vien">
                                        <EmployeeTargetUnifiedPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/cau-hinh-thi-dua" element={
                                    <ProtectedRoute path="/cau-hinh-thi-dua">
                                        <CampaignConfigPage />
                                    </ProtectedRoute>
                                } />

                                {/* Phân hệ Cấu hình Siêu thị & Nhân viên */}
                                <Route path="/cau-hinh-sieu-thi-nhan-vien" element={
                                    <ProtectedRoute path="/cau-hinh-sieu-thi-nhan-vien">
                                        <StoreEmployeeConfigPage />
                                    </ProtectedRoute>
                                } />

                                <Route path="/nhip-doanh-thu" element={
                                    <ProtectedRoute path="/nhip-doanh-thu">
                                        <RevenueTrendPage />
                                    </ProtectedRoute>
                                } />

                                {/* Phân hệ Quản trị Tài Khoản Người Dùng & Phân Quyền (Admin Only) */}
                                <Route path="/quan-ly-tai-khoan" element={
                                    <ProtectedRoute path="/quan-ly-tai-khoan">
                                        <UserManagementPage />
                                    </ProtectedRoute>
                                } />

                                <Route path="/phan-quyen-sieu-thi" element={
                                    <ProtectedRoute path="/phan-quyen-sieu-thi">
                                        <UserStorePermissionPage />
                                    </ProtectedRoute>
                                } />

                                <Route path="/quan-tri-he-thong" element={
                                    <ProtectedRoute path="/quan-tri-he-thong">
                                        <SystemAdminPage />
                                    </ProtectedRoute>
                                } />

                                {/* Route fallback: đường dẫn không tồn tại hoặc chưa được phân quyền */}
                                <Route path="*" element={
                                    <UnauthorizedAccessView
                                        title="Đường Dẫn Không Tồn Tại Hoặc Chưa Được Phân Quyền"
                                        badgeText="404 / 403"
                                        message="Đường dẫn bạn vừa truy cập không tồn tại trên hệ thống hoặc tài khoản của bạn chưa được cấp phép truy cập vào khu vực này."
                                        countdownSeconds={5}
                                        homePath="/bc-thang/tong-quan"
                                    />
                                } />
                            </Route>
                        </Routes>
                    </Suspense>
                </ZoomProvider>
            </PermissionProvider>
        </AuthProvider>
    );
}