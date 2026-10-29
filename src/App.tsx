import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ZoomProvider } from './shared/contexts/ZoomContext';
import { AuthProvider } from './shared/contexts/AuthContext';
import { PermissionProvider } from './shared/contexts/PermissionContext';
import MainLayout from './shared/components/layout/MainLayout';
import ProtectedRoute from './shared/components/layout/ProtectedRoute';
import UnauthorizedAccessView from './shared/components/layout/UnauthorizedAccessView';

const HomePage = lazy(() => import('./features/home/HomePage'));
const ClusterReportPage = lazy(() => import('./features/cluster-report/ClusterReportPage'));
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
const EmployeeRankingSummaryPage = lazy(() => import('./features/employee-ranking/EmployeeRankingSummaryPage'));
const EmployeePerformanceReportPage = lazy(() => import('./features/employee-performance/EmployeePerformanceReportPage'));
const EmployeeDetailReportPage = lazy(() => import('./features/employee-detail/EmployeeDetailReportPage'));
const EmployeeSessionManagerPage = lazy(() => import('./features/employee-cumulative/EmployeeSessionManagerPage'));
const CampaignSummaryPage = lazy(() => import('./features/campaign-summary/CampaignSummaryPage'));
const CampaignProgressPage = lazy(() => import('./features/campaign-progress/CampaignProgressPage'));
const SystemAdminPage = lazy(() => import('./features/admin-config/SystemAdminPage'));
const UserManagementPage = lazy(() => import('./features/admin-config/UserManagementPage'));
const UserStorePermissionPage = lazy(() => import('./features/admin-config/UserStorePermissionPage'));
const DataStatusPage = lazy(() => import('./features/data-status/DataStatusPage'));
const VoucherClaimPage = lazy(() => import('./features/voucher/VoucherClaimPage'));
const VoucherAdminPage = lazy(() => import('./features/voucher/VoucherAdminPage'));
const XmusicPlaylistPage = lazy(() => import('./features/xmusic-playlist/XmusicPlaylistPage'));
const SupportTicketPage = lazy(() => import('./features/support-ticket/SupportTicketPage'));
const EmployeeCumulativeRankingPage = lazy(() => import('./features/employee-cumulative-ranking/EmployeeCumulativeRankingPage'));
const CampaignDirectoryPage = lazy(() => import('./features/campaign-directory/CampaignDirectoryPage'));
const InventoryBalancingPage = lazy(() => import('./features/inventory-balancing/InventoryBalancingPage'));
const CashCounterPage = lazy(() => import('./features/cash-counter/CashCounterPage'));
const GuestAccountsPage = lazy(() => import('./features/admin-config/GuestAccountsPage'));
const CampaignOffsetPage = lazy(() => import('./features/campaign-offset/CampaignOffsetPage'));
const SampleDataPage = lazy(() => import('./features/sample-data/SampleDataPage'));

// Các trang Định danh, Đăng ký & Onboarding
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const OnboardingPage = lazy(() => import('./features/auth/OnboardingPage'));
const PendingApprovalPage = lazy(() => import('./features/auth/PendingApprovalPage'));
const ResetPasswordCallbackPage = lazy(() => import('./features/auth/ResetPasswordCallbackPage'));
const AccountLookupPage = lazy(() => import('./features/auth/AccountLookupPage'));

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
                            <Route path="/tra-cuu-tai-khoan" element={<AccountLookupPage />} />

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

                                {/* Phân hệ Báo Cáo Cụm Siêu Thị (Bảng 11 Cột) */}
                                <Route path="/bao-cao-cum-sieu-thi" element={
                                    <ProtectedRoute path="/bao-cao-cum-sieu-thi">
                                        <ClusterReportPage />
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
                                <Route path="/bc-realtime-con-lai" element={<Navigate to="/bc-ngay/tong-quan?tab=remaining" replace />} />
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

                                {/* Báo Cáo Tổng Hợp Xếp Hạng Nhân Viên */}
                                <Route path="/tong-hop-xep-hang-nhan-vien" element={
                                    <ProtectedRoute path="/tong-hop-xep-hang-nhan-vien">
                                        <EmployeeRankingSummaryPage />
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

                                {/* Tra Cứu Chương Trình Thi Đua */}
                                <Route path="/tra-cuu-thi-dua" element={
                                    <ProtectedRoute path="/tra-cuu-thi-dua">
                                        <CampaignDirectoryPage />
                                    </ProtectedRoute>
                                } />

                                {/* Báo Cáo Xếp Hạng Doanh Thu Nhân Viên Lũy Kế */}
                                <Route path="/xep-hang-doanh-thu-luy-ke" element={
                                    <ProtectedRoute path="/xep-hang-doanh-thu-luy-ke">
                                        <EmployeeCumulativeRankingPage />
                                    </ProtectedRoute>
                                } />

                                {/* Quản Lý & Chốt Cấn Trừ Thi Đua Cuối Tháng */}
                                <Route path="/can-tru-thi-dua" element={
                                    <ProtectedRoute path="/can-tru-thi-dua">
                                        <CampaignOffsetPage />
                                    </ProtectedRoute>
                                } />

                                {/* Phân hệ Cập nhật & Quản lý */}
                                <Route path="/trang-thai-du-lieu" element={
                                    <ProtectedRoute path="/trang-thai-du-lieu">
                                        <DataStatusPage />
                                    </ProtectedRoute>
                                } />
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
                                <Route path="/du-lieu-mau" element={
                                    <ProtectedRoute path="/du-lieu-mau">
                                        <SampleDataPage />
                                    </ProtectedRoute>
                                } />

                                {/* Phân hệ Cấp & Quản lý Voucher Bán Hàng */}
                                <Route path="/cap-ma-voucher" element={
                                    <ProtectedRoute path="/cap-ma-voucher">
                                        <VoucherClaimPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/quan-ly-voucher" element={
                                    <ProtectedRoute path="/quan-ly-voucher">
                                        <VoucherAdminPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/xmusic-playlist" element={
                                    <ProtectedRoute path="/xmusic-playlist">
                                        <XmusicPlaylistPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/ho-tro-gop-y" element={
                                    <ProtectedRoute path="/ho-tro-gop-y">
                                        <SupportTicketPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/can-ton-kho" element={
                                    <ProtectedRoute path="/can-ton-kho">
                                        <InventoryBalancingPage />
                                    </ProtectedRoute>
                                } />
                                <Route path="/kiem-quy" element={
                                    <ProtectedRoute path="/kiem-quy">
                                        <CashCounterPage />
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

                                <Route path="/quan-tri-he-thong/tai-khoan-trai-nghiem" element={
                                    <ProtectedRoute path="/quan-tri-he-thong/tai-khoan-trai-nghiem">
                                        <GuestAccountsPage />
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