import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './shared/components/layout/MainLayout';
import UnauthorizedAccessView from './shared/components/layout/UnauthorizedAccessView';

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
const EmployeeDetailReportPage = lazy(() => import('./features/employee-detail/EmployeeDetailReportPage'));
const EmployeeSessionManagerPage = lazy(() => import('./features/employee-cumulative/EmployeeSessionManagerPage'));
const CampaignSummaryPage = lazy(() => import('./features/campaign-summary/CampaignSummaryPage'));
const CampaignProgressPage = lazy(() => import('./features/campaign-progress/CampaignProgressPage'));
const SystemAdminPage = lazy(() => import('./features/admin-config/SystemAdminPage'));
const UserManagementPage = lazy(() => import('./features/admin-config/UserManagementPage'));
const UserStorePermissionPage = lazy(() => import('./features/admin-config/UserStorePermissionPage'));

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

                    {/* Báo Cáo Hiệu Quả Doanh Thu Nhân Viên & Chi Tiết */}
                    <Route path="/bao-cao-hieu-qua-nhan-vien" element={<EmployeePerformanceReportPage />} />
                    <Route path="/chi-tiet-nhan-vien" element={<EmployeeDetailReportPage />} />

                    {/* Báo Cáo Tổng Hợp Thi Đua Ngành Hàng & Tiến Độ Thi Đua */}
                    <Route path="/tong-hop-thi-dua" element={<CampaignSummaryPage />} />
                    <Route path="/tien-do-thi-dua" element={<CampaignProgressPage />} />

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
                    <Route path="/phan-quyen-sieu-thi" element={<UserStorePermissionPage />} />
                    <Route path="/quan-tri-he-thong" element={<SystemAdminPage />} />

                    {/* Tuyến đường dự phòng */}
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
    );
}