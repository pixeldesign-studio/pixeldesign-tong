/**
 * ============================================================
 * PIXELDESIGN CRM — Cấu hình tập trung
 * ============================================================
 * Chỉnh sửa file này khi cần thay đổi cấu hình kết nối.
 * KHÔNG commit file này lên repository công khai.
 * ============================================================
 */

const CONFIG = {

  // ──────────────────────────────────────────────────────────
  // GOOGLE OAUTH 2.0
  // Lấy từ: console.cloud.google.com → APIs & Services → Credentials
  // ──────────────────────────────────────────────────────────
  CLIENT_ID: '692386348752-9h282jk67080lc2p6al3uqiqtci45em8.apps.googleusercontent.com',

  // ──────────────────────────────────────────────────────────
  // GOOGLE SHEETS
  // Lấy từ URL: https://docs.google.com/spreadsheets/d/[ID]/edit
  // ──────────────────────────────────────────────────────────
  SPREADSHEET_ID: '1z08e97QicqdeXQJX_22yRXmE9HCqNtNdDUreLOhY4Nk',
  FINANCE_SPREADSHEET_ID: '1FzUqwNxjofKGB8BpPs4_SS4VTEj6SbhJwLmY_pP3jJI',
  OPERATION_SPREADSHEET_ID: '1pzBurrJji6mAE_UYlDDZc6g8ibIj8okslXNYLRkQ0v4',
  PAYROLL_SPREADSHEET_ID: '1mx2zXi9r4omD9gPMqfl2icZ25GaC3sb0zeDDyofe-QM',

  // ──────────────────────────────────────────────────────────
  // GOOGLE API SCOPES
  // Quyền truy cập được yêu cầu khi đăng nhập
  // Mỗi khi thêm/bớt scope, tăng SCOPE_VERSION lên 1
  // để app tự động xoá session cũ và yêu cầu đăng nhập lại
  // ──────────────────────────────────────────────────────────
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets', // Đọc + ghi Google Sheets
    'https://www.googleapis.com/auth/drive.file',   // Upload ảnh lên Google Drive
    'profile',                                       // Tên, ảnh đại diện
    'email',                                         // Địa chỉ email
  ].join(' '),

  // Tăng số này mỗi khi thay đổi SCOPES để buộc re-auth
  SCOPE_VERSION: 2,

  // ──────────────────────────────────────────────────────────
  // TÊN CÁC TAB TRONG GOOGLE SHEETS
  // Phải khớp chính xác với tên tab trong file Sheets
  // ──────────────────────────────────────────────────────────
  SHEETS: {
    DOANH_THU_KHAC: 'DOANH_THU_KHAC',
    TAI_CHINH_TONG: 'TAI_CHINH_TONG',
    GIAO_DICH_TIEN: 'GIAO_DICH_TIEN',
    TIEN_DON:       'TIEN_DON',
    DON_HANG:       'DON_HANG',
    DIEM_DESIGNER:  'DIEM_DESIGNER',
    CAU_HINH_LUONG: 'CAU_HINH_LUONG',
    DANH_MUC_NGANH: 'DANH_MUC_NGANH',
    DANH_MUC_ITEM:  'DANH_MUC_ITEM',
  },

  // ──────────────────────────────────────────────────────────
  // VAI TRÒ NGƯỜI DÙNG
  // Phải khớp với giá trị cột "vai_tro" trong tab NHAN_SU
  // ──────────────────────────────────────────────────────────
  ROLES: {
    ADMIN:    'admin',
    SALE:     'sale',
    DESIGNER: 'designer',
  },

  // ──────────────────────────────────────────────────────────
  // CÀI ĐẶT KHÁC
  // ──────────────────────────────────────────────────────────
  APP_NAME:    'PIXELDESIGN TỔNG',
  APP_VERSION: '1.0.0',

  // Thời gian session tối đa (ms) — mặc định: 1 tiếng
  // Google OAuth token thường có hiệu lực 3600 giây (1 tiếng)
  SESSION_DURATION: 60 * 60 * 1000,

};

// Đóng băng object để tránh vô tình sửa đổi trong runtime
Object.freeze(CONFIG);
Object.freeze(CONFIG.SHEETS);
Object.freeze(CONFIG.ROLES);
