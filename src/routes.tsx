import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './shared/components/layout/MainLayout';

const MonthlyReportPage = lazy(() => import('./features/monthly-report/MonthlyReportPage'));
const DailyReportPage = lazy(() => import('./features/daily-report/DailyReportPage'));
const DailyEmployeeRevenueReportPage = lazy(() => import('./features/daily-report/DailyEmployeeRevenueReportPage'));
const DataUpdatePage = lazy(() => import('./features/data-update/DataUpdatePage'));
const DataManagerPage = lazy(() => import('./features/data-management/DataManagerPage'));
const RevenueTrendPage = lazy(() => import('./features/revenue-trend/RevenueTrendPage'));
const EmployeeTargetUnifiedPage = lazy(() => import('./features/employee-health/EmployeeTargetUnifiedPage'));
const CampaignConfigPage = lazy(() => import('./features/admin-config/CampaignConfigPage'));
const StoreEmployeeConfigPage = lazy(() => import('./features/store-management/StoreEmployeeConfigPage'));
const EmployeeCumulativePage = lazy(() => import('./features/employee-cumulative/EmployeeCumulativePage'));
const EmployeePerformanceReportPage = lazy(() => import('./features/employee-performance/EmployeePerformanceReportPage'));
const EmployeeSessionManagerPage = lazy(() => import('./features/employee-cumulative/EmployeeSessionManagerPage'));
const CampaignSummaryPage = lazy(() => import('./features/campaign-summary/CampaignSummaryPage'));
const SystemAdminPage = lazy(() => import('./features/admin-config/SystemAdminPage'));
const UserManagementPage = lazy(() => import('./features/admin-config/UserManagementPage'));

const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const OnboardingPage = lazy(() => import('./features/auth/OnboardingPage'));
const PendingApprovalPage = lazy(() => import('./features/auth/PendingApprovalPage'));

export function AppRoutes() {
    return (
        <Suspense fallback={
            <div className="h-screen flex items-center justify-center text-xs font-semibold text-slate-400">
                Đang tải phân hệ...
            </div>
        }>
            <Routes>
                <Route path="/dang-nhap" element={<LoginPage />} />
                <Route path="/dang-ky" element={<RegisterPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/cho-xet-duyet" element={<PendingApprovalPage />} />

                <Route element={<MainLayout />}>
                    <Route path="/" element={<Navigate to="/bc-thang/tong-quan" replace />} />

                    {/* Phân hệ BC Tháng */}
                    <Route path="/bc-thang" element={<Navigate to="/bc-thang/tong-quan" replace />} />
                    <Route path="/bc-thang/tong-quan" element={<MonthlyReportPage />} />

                    {/* Phân hệ BC Ngày */}
                    <Route path="/bc-ngay" element={<Navigate to="/bc-ngay/tong-quan" replace />} />
                    <Route path="/bc-ngay/tong-quan" element={<DailyReportPage />} />
                    <Route path="/bc-ngay-nhan-vien" element={<DailyEmployeeRevenueReportPage />} />

                    {/* Báo Cáo Hiệu Quả Doanh Thu Nhân Viên */}
                    <Route path="/bao-cao-hieu-qua-nhan-vien" element={<EmployeePerformanceReportPage />} />

                    {/* Báo Cáo Tổng Hợp Thi Đua Ngành Hàng */}
                    <Route path="/tong-hop-thi-dua" element={<CampaignSummaryPage />} />

                    {/* Phân hệ Cập nhật Dữ liệu */}
                    <Route path="/cap-nhat" element={<DataUpdatePage />} />
                    <Route path="/cap-nhat-luy-ke-nhan-vien" element={<EmployeeCumulativePage />} />

                    {/* Tuyến đường Quản Lý Dữ Liệu & Phiên */}
                    <Route path="/quan-ly-du-lieu" element={<DataManagerPage />} />
                    <Route path="/quan-ly-phien-nhan-vien" element={<EmployeeSessionManagerPage />} />

                    <Route path="/nhip-doanh-thu" element={<RevenueTrendPage />} />

                    <Route path="/muc-tieu-nhan-vien" element={<EmployeeTargetUnifiedPage />} />
                    <Route path="/suc-khoe-nv" element={<EmployeeTargetUnifiedPage />} />

                    <Route path="/cau-hinh-thi-dua" element={<CampaignConfigPage />} />
                    <Route path="/cau-hinh-sieu-thi-nhan-vien" element={<StoreEmployeeConfigPage />} />

                    <Route path="/quan-ly-tai-khoan" element={<UserManagementPage />} />
                    <Route path="/quan-tri-he-thong" element={<SystemAdminPage />} />

                    {/* Tuyến đường dự phòng */}
                    <Route path="*" element={<Navigate to="/bc-thang/tong-quan" replace />} />
                </Route>
            </Routes>
        </Suspense>
    );
}