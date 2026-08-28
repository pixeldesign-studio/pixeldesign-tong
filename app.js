/**
 * ============================================================
 * PIXELDESIGN CRM — app.js
 * Bước 1: Google Auth + Phân quyền + Menu skeleton
 * ============================================================
 */

const App = {

  // ──────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────
  session:     null,
  tokenClient: null,
  currentPage: 'don-hang',


  // ──────────────────────────────────────────────────────────
  // BOOTSTRAP
  // ──────────────────────────────────────────────────────────

  /**
   * Điểm khởi đầu của app.
   * Được gọi sau khi cả DOM lẫn Google GSI script đã sẵn sàng.
   */
  init() {
    // Thử khôi phục session từ localStorage
    this.session = this._loadSession();

    // Kiểm tra session còn hạn VÀ đúng scope version
    // Nếu scopes đã thay đổi (SCOPE_VERSION tăng), buộc đăng nhập lại
    // để lấy token mới với đủ quyền truy cập
    const scopeOk = this.session?.scopeVersion === CONFIG.SCOPE_VERSION;

    if (this.session && !this._isTokenExpired() && scopeOk) {
      console.log('[Auth] Session còn hạn và đúng scope version, bỏ qua đăng nhập.');
      this._renderApp();
    } else {
      if (this.session && !scopeOk) {
        console.log(`[Auth] Scope version cũ (${this.session?.scopeVersion}) < hiện tại (${CONFIG.SCOPE_VERSION}). Xoá session, yêu cầu đăng nhập lại.`);
      }
      this._clearSession();
      this._showLogin();
      this._initGoogleTokenClient();
    }
  },

  /**
   * Gọi khi người dùng bấm nút "Đăng nhập với Google".
   */
  signIn() {
    if (!this.tokenClient) {
      // GSI script chưa load xong, thử khởi tạo lại
      this._initGoogleTokenClient();
      if (!this.tokenClient) {
        this._showLoginError('Google Script chưa sẵn sàng. Vui lòng thử lại sau giây lát.');
        return;
      }
    }
    this._hideLoginError();
    this.tokenClient.requestAccessToken();
  },

  /**
   * Đăng xuất: thu hồi token, xóa session, về màn login.
   */
  signOut() {
    if (this.session?.accessToken) {
      try {
        google.accounts.oauth2.revoke(this.session.accessToken, () => {
          console.log('[Auth] Token đã được thu hồi.');
        });
      } catch (e) {
        // Ignore nếu token đã hết hạn
      }
    }
    this._clearSession();
    this.tokenClient = null;

    // Reset UI
    document.getElementById('app-shell').classList.add('hidden');
    this._showLogin();
    this._resetLoginButton();
    this._hideLoginError();
    this._initGoogleTokenClient();
  },

  /**
   * Xử lý user menu (click vào avatar/tên ở bottom sidebar).
   * Hiện tại chỉ show tooltip/info, có thể mở rộng sau.
   */
  showUserMenu(event) {
    // Không làm gì thêm ở bước 1 (nút đăng xuất đã riêng)
  },


  // ──────────────────────────────────────────────────────────
  // NAVIGATION
  // ──────────────────────────────────────────────────────────

  /**
   * Chuyển trang.
   * @param {string} page - ID trang (vd: 'don-hang', 'kanban')
   */
  navigateTo(page) {
    if (!this.session) return;

    const { role } = this.session;

    // Mọi trang đều cần quyền admin
    if (role !== 'admin') {
      this._showToast('Bạn không có quyền truy cập trang này.', 'error');
      return;
    }

    this.currentPage = page;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const config = this._getPageMeta(page);
    document.getElementById('page-title').textContent    = config.title;
    document.getElementById('page-subtitle').textContent = config.subtitle;
    document.getElementById('page-actions').innerHTML    = '';

    // Giai đoạn 1: Render theo từng màn hình
    if (page === 'doanh-thu-etsy') {
      this.renderDoanhThuEtsyPage();
    } else if (page === 'keo-doanh-thu-pixel') {
      this.renderKeoDoanhThuPixelPage();
    } else if (page === 'phan-tich-tong') {
      this.renderPhanTichTongPage();
    } else if (page === 'tai-chinh-tong') {
      this.renderTaiChinhTongPage();
    } else if (page === 'hieu-suat-nhan-su') {
      this.renderHieuSuatNhanSuPage();
    } else {
      document.getElementById('page-content').innerHTML = this._buildPlaceholder(config);
    }
  },

  /**
   * Metadata cho từng trang (tiêu đề, mô tả, icon).
   */
  _getPageMeta(page) {
    const map = {
      'doanh-thu-etsy':      { title: 'Doanh thu Etsy',       subtitle: 'Báo cáo doanh thu từ Etsy',            icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\"/><polyline points=\"16 7 22 7 22 13\"/></svg>', color: '#8A724C' },
      'keo-doanh-thu-pixel': { title: 'Doanh thu Pixel',  subtitle: 'Số liệu lấy trực tiếp từ app PIXELDESIGN',        icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M6 12h.01M18 12h.01\"/></svg>', color: '#5B8DB8' },
      'phan-tich-tong':      { title: 'Phân tích tổng',       subtitle: 'Biểu đồ và phân tích chuyên sâu',        icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v18h18\"/><path d=\"M18 17V9\"/><path d=\"M13 17V5\"/><path d=\"M8 17v-3\"/></svg>', color: '#E74C3C' },
      'tai-chinh-tong':      { title: 'Tài chính tổng',       subtitle: 'Quản lý thu chi và tài chính',           icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12V7H5a2 2 0 0 1 0-4h14v4\"/><path d=\"M3 5v14a2 2 0 0 0 2 2h16v-5\"/><path d=\"M18 12a2 2 0 0 0 0 4h4v-4z\"/></svg>', color: '#F39C12' },
      'hieu-suat-nhan-su':   { title: 'Chi lương & Hiệu suất', subtitle: 'Phân tích chi phí lương và hiệu suất', icon: '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"20\" x2=\"18\" y2=\"10\"/><line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"4\"/><line x1=\"6\" y1=\"20\" x2=\"6\" y2=\"14\"/></svg>', color: '#27AE60' },
    };
    return map[page] || { title: page, subtitle: '', icon: '📄', color: '#8A724C' };
  },

  /**
   * Build HTML placeholder cho trang chưa có nội dung.
   */
  _buildPlaceholder({ title, subtitle, icon }) {
    return `
      <div class="placeholder-card">
        <div class="placeholder-icon">${icon}</div>
        <h2>${title}</h2>
        <p>${subtitle}<br/>Nội dung màn hình này sẽ được phát triển ở bước tiếp theo.</p>
        <div class="placeholder-badge">🚧 Đang phát triển</div>
      </div>
    `;
  },


  // ──────────────────────────────────────────────────────────
  // GOOGLE OAUTH — Token Client (Implicit Grant)
  // ──────────────────────────────────────────────────────────

  _initGoogleTokenClient() {
    if (typeof google === 'undefined' || !google?.accounts?.oauth2) {
      console.warn('[Auth] Google GSI chưa sẵn sàng.');
      return;
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope:     CONFIG.SCOPES,
      callback:  (response) => this._handleTokenResponse(response),
    });

    console.log('[Auth] Token client khởi tạo thành công.');
  },

  /**
   * Callback nhận access_token từ Google.
   */
  async _handleTokenResponse(response) {
    if (response.error) {
      console.error('[Auth] Lỗi OAuth:', response);
      const messages = {
        'access_denied':  'Bạn đã từ chối quyền truy cập.',
        'popup_closed':   'Cửa sổ đăng nhập bị đóng. Vui lòng thử lại.',
        'popup_failed_to_open': 'Không thể mở cửa sổ đăng nhập. Hãy bật pop-up cho trang này.',
      };
      this._showLoginError(messages[response.error] || `Lỗi đăng nhập: ${response.error}`);
      this._resetLoginButton();
      return;
    }

    const accessToken = response.access_token;
    const expiresIn   = parseInt(response.expires_in) || 3600;

    try {
      // Bước 1: Lấy thông tin người dùng Google
      this._setLoginLoading('Đang xác thực tài khoản...');
      const userInfo = await this._fetchUserInfo(accessToken);
      console.log('[Auth] Người dùng:', userInfo.email);

      // Bước 2: Đối chiếu email (Chỉ admin được phép)
      if (userInfo.email !== 'mrvusonhai@gmail.com') {
        this._resetLoginButton();
        this._showLoginError(
          `Chỉ admin được phép truy cập. Email "${userInfo.email}" bị từ chối.`
        );
        return;
      }

      const role = 'admin';

      // Bước 3: Lưu session (kèm scopeVersion để phát hiện token cũ thiếu quyền)
      const session = {
        email:        userInfo.email,
        name:         userInfo.name || 'Admin',
        picture:      userInfo.picture || null,
        role:         role,
        ten:          userInfo.name || 'Admin',
        accessToken:  accessToken,
        tokenExpiry:  Date.now() + expiresIn * 1000,
        scopeVersion: CONFIG.SCOPE_VERSION, // dùng để phát hiện token cũ thiếu quyền
      };
      this._saveSession(session);

      console.log(`[Auth] Đăng nhập thành công. Vai trò: ${role}`);

      // Bước 6: Render app
      this._renderApp();

    } catch (err) {
      console.error('[Auth] Lỗi xử lý:', err);
      this._resetLoginButton();
      this._showLoginError(`Có lỗi xảy ra: ${err.message}`);
    }
  },


  // ──────────────────────────────────────────────────────────
  // GOOGLE APIs
  // ──────────────────────────────────────────────────────────

  /**
   * Lấy thông tin profile của người dùng đang đăng nhập.
   */
  async _fetchUserInfo(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`userinfo API lỗi: ${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  /**
   * Helper: Trả về Spreadsheet ID đúng theo tab dữ liệu
   */
  _getSpreadsheetIdFor(sheetName) {
    if ([CONFIG.SHEETS.GIAO_DICH_TIEN, CONFIG.SHEETS.TIEN_DON].includes(sheetName)) {
      return CONFIG.FINANCE_SPREADSHEET_ID;
    }
    return CONFIG.SPREADSHEET_ID;
  },

  /**
   * Đọc toàn bộ dữ liệu một tab trong Google Sheets.
   * Trả về mảng object { header: value }.
   *
   * @param {string} accessToken
   * @param {string} sheetName  - Tên tab (vd: 'NHAN_SU')
   * @param {string} [range]    - Range bổ sung, mặc định là toàn bộ sheet
   * @param {string} [overrideSpreadsheetId] - Ghi đè Spreadsheet ID mặc định
   * @returns {Promise<Object[]>}
   */
  async _readSheet(accessToken, sheetName, range = '', overrideSpreadsheetId = null) {
    const token    = accessToken || this.session?.accessToken;
    const fullRange = range ? `${sheetName}!${range}` : sheetName;
    const targetSpreadsheetId = overrideSpreadsheetId || this._getSpreadsheetIdFor(sheetName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(fullRange)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        detail = errBody.error?.message || detail;
      } catch (_) {}

      // Xử lý êm lỗi 403 (Permission Denied) đối với các file tài chính và vận hành
      if (res.status === 403) {
        if (targetSpreadsheetId === CONFIG.FINANCE_SPREADSHEET_ID) {
          console.warn(`[TÀI CHÍNH] Không có quyền truy cập tab ${sheetName} (Lỗi 403). Bỏ qua dữ liệu này thay vì báo lỗi.`);
          return []; // Trả về mảng rỗng để phần còn lại của app không bị crash
        }
        if (targetSpreadsheetId === CONFIG.OPERATION_SPREADSHEET_ID) {
          console.warn(`[VẬN HÀNH PXD] Không có quyền truy cập tab ${sheetName} (Lỗi 403). Bỏ qua dữ liệu này thay vì báo lỗi.`);
          this._showToast(`Chưa có quyền đọc dữ liệu PXD, vui lòng kiểm tra chia sẻ file (${sheetName})`, 'error');
          return []; // Trả về mảng rỗng để phần còn lại của app không bị crash
        }
      }

      throw new Error(`Không thể đọc Sheet "${sheetName}": ${detail}`);
    }

    const data = await res.json();
    return this._parseSheet(data.values || []);
  },

  /**
   * Ghi dữ liệu vào một vùng trong Google Sheets.
   *
   * @param {string} sheetName
   * @param {string} range       - VD: 'A2:D2'
   * @param {Array[]} values     - Mảng 2 chiều
   * @returns {Promise<Object>}
   */
  async _writeSheet(sheetName, range, values) {
    const token    = this.session?.accessToken;
    const fullRange = `${sheetName}!${range}`;
    const targetSpreadsheetId = this._getSpreadsheetIdFor(sheetName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(fullRange)}?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method:  'PUT',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range: fullRange, majorDimension: 'ROWS', values }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        detail = errBody.error?.message || detail;
      } catch (_) {}
      throw new Error(`Không thể ghi Sheet "${sheetName}": ${detail}`);
    }

    return res.json();
  },

  /**
   * Append (thêm dòng mới) vào cuối một Sheet.
   *
   * @param {string} sheetName
   * @param {Array[]} values - Mảng 2 chiều
   * @returns {Promise<Object>}
   */
  async _appendSheet(sheetName, values) {
    const token = this.session?.accessToken;
    const range = `${sheetName}!A1`;
    const targetSpreadsheetId = this._getSpreadsheetIdFor(sheetName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        detail = errBody.error?.message || detail;
      } catch (_) {}
      throw new Error(`Không thể append Sheet "${sheetName}": ${detail}`);
    }

    return res.json();
  },

  /**
   * Lưu hoặc cập nhật tong_gia_tri vào tab TIEN_DON (Tài chính).
   * @param {string} maDon 
   * @param {number} tongGiaTri 
   */
  async _saveTienDon(maDon, tongGiaTri) {
    if (!this.session?.accessToken || this.session.role === CONFIG.ROLES.DESIGNER) return;
    try {
      const rows = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.TIEN_DON, 'A:B').catch(() => []);
      const index = (rows || []).findIndex(r => r.ma_don === maDon);
      if (index >= 0) {
        const rowNum = index + 2; // header is row 1
        await this._writeSheet(CONFIG.SHEETS.TIEN_DON, `B${rowNum}`, [[tongGiaTri || 0]]);
      } else {
        await this._appendSheet(CONFIG.SHEETS.TIEN_DON, [[maDon, tongGiaTri || 0]]);
      }
    } catch (err) {
      console.warn('Lỗi khi lưu TIEN_DON:', err.message);
    }
  },

  /**
   * Chuyển mảng 2 chiều từ Sheets API thành mảng object.
   * Hàng đầu tiên là tên cột.
   */
  _parseSheet(values) {
    if (!values || values.length < 1) return [];
    const headers = values[0];
    if (values.length < 2) return [];
    return values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h.trim()] = (row[i] !== undefined) ? String(row[i]).trim() : '';
      });
      return obj;
    });
  },

  /**
   * Tìm nhân sự theo email (case-insensitive).
   */
  _findByEmail(list, email) {
    const target = (email || '').toLowerCase().trim();
    return list.find(r => (r.email || '').toLowerCase().trim() === target) || null;
  },


  // ──────────────────────────────────────────────────────────
  // UI: APP RENDER
  // ──────────────────────────────────────────────────────────

  /**
   * Render toàn bộ app sau khi xác thực xong.
   */
  async _renderApp() {
    const { name, picture, role } = this.session;

    // Ẩn login, hiện app
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');

    // Avatar
    const avatarEl = document.getElementById('user-avatar');
    if (picture) {
      avatarEl.innerHTML = `<img src="${picture}" alt="${this._escHtml(name)}" referrerpolicy="no-referrer" />`;
    } else {
      avatarEl.innerHTML = `<span>${(name || '?').charAt(0).toUpperCase()}</span>`;
    }

    // Tên & vai trò
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-role').innerHTML   = this._buildRoleChip(role);

    // Áp dụng phân quyền menu
    this._applyRolePermissions(role);

    // Init token client cho những lần sau (token refresh)
    if (!this.tokenClient) this._initGoogleTokenClient();

    // Điều hướng đến trang mặc định
    this.navigateTo('doanh-thu-etsy');
    this._showToast(`Chào mừng trở lại, ${name.split(' ').pop()}! 👋`, 'success');
  },

  /**
   * Ẩn/hiện các mục menu theo vai trò.
   * Các element có `data-role="admin"` chỉ admin mới thấy.
   */
  _applyRolePermissions(role) {
    document.querySelectorAll('[data-role="admin"]').forEach(el => {
      const isVisible = (role === CONFIG.ROLES.ADMIN);
      el.style.display = isVisible ? '' : 'none';
    });
    document.querySelectorAll('[data-role="admin-sale"]').forEach(el => {
      const isVisible = (role === CONFIG.ROLES.ADMIN || role === CONFIG.ROLES.SALE);
      el.style.display = isVisible ? '' : 'none';
    });
  },

  /**
   * Build HTML badge vai trò.
   */
  _buildRoleChip(role) {
    const labels = {
      admin:    '👑 Admin',
      sale:     '💼 Sale',
      designer: '🎨 Designer',
    };
    return `<span class="role-chip ${role}">${labels[role] || role}</span>`;
  },


  // ──────────────────────────────────────────────────────────
  // UI: LOGIN SCREEN
  // ──────────────────────────────────────────────────────────

  _showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  },

  _setLoginLoading(msg) {
    const btn = document.getElementById('login-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${this._escHtml(msg)}`;
  },

  _resetLoginButton() {
    const btn = document.getElementById('login-btn');
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" class="google-icon">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Đăng nhập với Google`;
  },

  _showLoginError(msg) {
    const el = document.getElementById('login-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';
  },

  _hideLoginError() {
    const el = document.getElementById('login-error');
    if (el) el.classList.add('hidden');
  },


  // ──────────────────────────────────────────────────────────
  // UI: TOAST
  // ──────────────────────────────────────────────────────────

  _showToast(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity    = '0';
      toast.style.transform  = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },


  // ──────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ──────────────────────────────────────────────────────────

  _saveSession(session) {
    try {
      localStorage.setItem('pixeldesign_session', JSON.stringify(session));
      this.session = session;
    } catch (e) {
      console.error('[Session] Không thể lưu session:', e);
    }
  },

  _loadSession() {
    try {
      const raw = localStorage.getItem('pixeldesign_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  _clearSession() {
    try { localStorage.removeItem('pixeldesign_session'); } catch (_) {}
    this.session = null;
  },

  _isTokenExpired() {
    if (!this.session?.tokenExpiry) return true;
    // Thêm buffer 60 giây để tránh token hết hạn giữa request
    return Date.now() >= (this.session.tokenExpiry - 60_000);
  },


  // ──────────────────────────────────────────────────────────
  // UTILITIES
  // ──────────────────────────────────────────────────────────

  /** Escape HTML để tránh XSS */
  _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },


  // ════════════════════════════════════════════════════════════
  // MODULE: DOANH THU ETSY
  // ════════════════════════════════════════════════════════════

  async renderDoanhThuEtsyPage() {
    document.getElementById('page-content').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:80px 0;flex-direction:column;gap:16px;">
        <div class="spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(138,114,76,0.2);border-top-color:var(--clr-accent);"></div>
        <p style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Đang tải dữ liệu doanh thu...</p>
      </div>
    `;
    await this._loadEtsyData();
    this._renderEtsyContent('month'); // Mặc định tháng này
  },

  async _loadEtsyData() {
    try {
      const data = await this._readSheet(null, CONFIG.SHEETS.DOANH_THU_KHAC);
      // Parse sang mảng object với các trường (ngay, nguon, so_tien, ghi_chu)
      let records = data.map((d, i) => ({
        ...d,
        _origIndex: i,
        parsedDate: new Date(d.ngay || 0),
        so_tien: parseInt((d.so_tien || '').replace(/[^0-9-]/g, ''), 10) || 0
      }));

      // Sắp xếp cũ nhất -> mới nhất để tính lũy kế đúng theo thời gian
      records.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

      const shopLastCumulative = {};

      for (const rec of records) {
        const shop = rec.nguon;
        if (shopLastCumulative[shop] === undefined) {
          rec.doanh_thu_phat_sinh = rec.so_tien;
        } else {
          rec.doanh_thu_phat_sinh = rec.so_tien - shopLastCumulative[shop];
        }
        shopLastCumulative[shop] = rec.so_tien;
      }
      // Đảo lại mới nhất lên đầu
      records.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
      
      this._etsyData = records;
    } catch (err) {
      console.error(err);
      this._etsyData = [];
      document.getElementById('page-content').innerHTML = `<div style="text-align:center; padding: 40px; color: #e53935;">Lỗi tải dữ liệu: ${this._escHtml(err.message)}</div>`;
    }
  },

  _formatVND(num) {
    return Number(num).toLocaleString('vi-VN') + ' đ';
  },

  _formatNumber(num) {
    return Number(num).toLocaleString('vi-VN');
  },

  _renderEtsyContent(filterType = 'month', customFrom = '', customTo = '', fShop = 'all') {
    const content = document.getElementById('page-content');
    if (!content) return;

    const today = new Date();
    let startDate, endDate;

    if (filterType === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterType === 'last_month') {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    } else if (filterType === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filterType === 'all') {
      startDate = new Date(0);
      endDate = new Date('2999-12-31');
    } else if (filterType === 'custom') {
      startDate = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(0);
      endDate = customTo ? new Date(customTo + 'T23:59:59') : new Date('2999-12-31');
    }

    let tongDoanhThu = 0;
    let tongApollo = 0;
    let tongJolie = 0;
    let tongWat = 0;

    const filteredRecords = [];
    const dailyMap = {};

    (this._etsyData || []).forEach(r => {
      if (r.parsedDate < startDate || r.parsedDate > endDate) return;
      if (fShop !== 'all' && r.nguon !== fShop) return;

      filteredRecords.push(r);
      const tien = r.doanh_thu_phat_sinh || 0;
      tongDoanhThu += tien;

      if (r.nguon === 'Apollo') tongApollo += tien;
      else if (r.nguon === 'Jolie') tongJolie += tien;
      else if (r.nguon === 'WAT') tongWat += tien;

      const dateStr = r.ngay || 'Chưa rõ';
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { 
          date: dateStr, 
          parsedDate: r.parsedDate.getTime(), 
          Apollo: 0, Jolie: 0, WAT: 0, total: 0 
        };
      }
      if (r.nguon) {
        dailyMap[dateStr][r.nguon] += tien;
      }
      dailyMap[dateStr].total += tien;
    });

    const btnStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-border-light, #e0e0e0); background:var(--clr-surface, #fff); cursor:pointer; font-size:13px; font-weight:500; color:var(--clr-text, #333); transition:all 0.2s;";
    const btnActiveStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-accent, #8A724C); background:var(--clr-accent, #8A724C); color:#fff; cursor:pointer; font-size:13px; font-weight:500; transition:all 0.2s;";
    const selectStyle = "padding:6px 10px; border-radius:8px; border:1px solid var(--clr-border-light, #e0e0e0); font-size:13px; background:var(--clr-surface, #fff);";

    const filterOnChange = `App._renderEtsyContent('${filterType}', '${customFrom}', '${customTo}', document.getElementById('etsy-fshop').value)`;

    const inputToday = new Date().toISOString().split('T')[0];

    content.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; display:flex; flex-direction:column; gap:24px;">
        
        <!-- CHỈ SỐ TỔNG -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:24px;">
          <div class="trendy-stat-card trendy-stat-1">
            <div class="stat-label-trendy">Tổng doanh thu</div>
            <div class="stat-num-trendy">${this._formatVND(tongDoanhThu)}</div>
          </div>
          <div class="trendy-stat-card trendy-stat-2">
            <div class="stat-label-trendy">Apollo</div>
            <div class="stat-num-trendy">${this._formatVND(tongApollo)}</div>
          </div>
          <div class="trendy-stat-card trendy-stat-3">
            <div class="stat-label-trendy">Jolie</div>
            <div class="stat-num-trendy">${this._formatVND(tongJolie)}</div>
          </div>
          <div class="trendy-stat-card trendy-stat-4">
            <div class="stat-label-trendy">WAT</div>
            <div class="stat-num-trendy">${this._formatVND(tongWat)}</div>
          </div>
        </div>

        <!-- FORM NHẬP -->
        <div class="glass-card mb-20">
          <h2 style="margin-top: 0; margin-bottom: 20px; font-size: 1.25rem; font-weight: 700; color: var(--clr-text-main);">Thêm bản ghi Doanh thu Etsy</h2>
          <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-weight: 600; font-size: 0.9rem;">Ngày nhập</label>
              <div class="custom-date-wrapper">
                <input type="date" onclick="this.showPicker()" onchange="App._xemTruocEtsy()" id="etsy-ngay" class="form-input custom-date-input" value="${inputToday}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--clr-border); border-radius: 8px; background: transparent;">
                <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
            </div>
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-weight: 600; font-size: 0.9rem;">Shop</label>
              <select id="etsy-nguon" class="form-input" onchange="App._xemTruocEtsy()" style="padding: 10px 12px; border: 1px solid var(--clr-border); border-radius: 8px;">
                <option value="Apollo">Apollo</option>
                <option value="Jolie">Jolie</option>
                <option value="WAT">WAT</option>
              </select>
            </div>
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-weight: 600; font-size: 0.9rem;">Số lũy kế (VNĐ)</label>
              <input type="text" id="etsy-sotien" class="form-input" placeholder="Ví dụ: 18.000.000" oninput="App._formatVNCurrencyInput(this); App._xemTruocEtsy()" style="padding: 10px 12px; border: 1px solid var(--clr-border); border-radius: 8px; font-variant-numeric: tabular-nums;">
              <span style="font-size: 0.75rem; color: var(--clr-text-muted); margin-top: -4px;">Nhập tổng net profit cộng dồn tại thời điểm này</span>
              <span id="etsy-xem-truoc" style="font-size: 0.8rem; font-weight: 600; margin-top: -2px; min-height: 18px;"></span>
            </div>
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-weight: 600; font-size: 0.9rem;">Ghi chú (không bắt buộc)</label>
              <input type="text" id="etsy-ghichu" class="form-input" placeholder="Ghi chú thêm..." style="padding: 10px 12px; border: 1px solid var(--clr-border); border-radius: 8px;">
            </div>
          </div>
          <div style="margin-top: 24px;">
            <button class="btn" id="btn-save-etsy" onclick="App._saveDoanhThuEtsy('${filterType}', '${customFrom}', '${customTo}', '${fShop}')" style="background-color: #8A724C; color: #ffffff; padding: 10px 24px; font-weight: 600; font-size: 1rem; border-radius: 8px; border: none; cursor: pointer; display: inline-block;">
              Lưu bản ghi
            </button>
          </div>
        </div>

        <!-- BẢNG LIỆT KÊ -->
        ${this._buildEtsyTableHtml(filteredRecords)}

        <!-- BỘ LỌC -->
        <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button style="${filterType === 'month' ? btnActiveStyle : btnStyle}" onclick="App._renderEtsyContent('month', '', '', '${this._escHtml(fShop)}')">Tháng này</button>
              <button style="${filterType === 'last_month' ? btnActiveStyle : btnStyle}" onclick="App._renderEtsyContent('last_month', '', '', '${this._escHtml(fShop)}')">Tháng trước</button>
              <button style="${filterType === 'year' ? btnActiveStyle : btnStyle}" onclick="App._renderEtsyContent('year', '', '', '${this._escHtml(fShop)}')">Năm nay</button>
              <button style="${filterType === 'all' ? btnActiveStyle : btnStyle}" onclick="App._renderEtsyContent('all', '', '', '${this._escHtml(fShop)}')">Tất cả</button>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <span style="font-size:14px; font-weight:500;">Hoặc chọn ngày:</span>
              <div class="custom-date-wrapper" style="width:130px;">
                <input type="date" onclick="this.showPicker()" id="etsy-from" class="form-input custom-date-input" style="width:100%; padding:6px 10px; background:transparent;" value="${customFrom}">
                <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span style="color:var(--clr-text-muted);">-</span>
              <div class="custom-date-wrapper" style="width:130px;">
                <input type="date" onclick="this.showPicker()" id="etsy-to" class="form-input custom-date-input" style="width:100%; padding:6px 10px; background:transparent;" value="${customTo}">
                <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <button class="btn btn-outline btn-sm glass-button" style="padding:6px 12px; border:1px solid rgba(255,255,255,0.5); border-radius:8px; cursor:pointer;" onclick="App._renderEtsyContent('custom', document.getElementById('etsy-from').value, document.getElementById('etsy-to').value, '${this._escHtml(fShop)}')">Lọc</button>
            </div>
          </div>
          <div style="border-top:1px dashed #e0e0e0; margin:4px 0;"></div>
          <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Shop:</label>
              <select id="etsy-fshop" style="${selectStyle}" onchange="${filterOnChange}">
                <option value="all" ${fShop==='all'?'selected':''}>Tất cả</option>
                <option value="Apollo" ${fShop==='Apollo'?'selected':''}>Apollo</option>
                <option value="Jolie" ${fShop==='Jolie'?'selected':''}>Jolie</option>
                <option value="WAT" ${fShop==='WAT'?'selected':''}>WAT</option>
              </select>
            </div>
          </div>
        </div>

        <!-- BIỂU ĐỒ -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
          <!-- Biểu đồ Đường -->
          <div class="glass-card" style="display:flex; flex-direction:column; grid-column: 1 / -1;">
            <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">Xu hướng Doanh thu phát sinh (VNĐ)</h3>
            <div style="flex-grow:1; min-height:300px; position:relative; display:flex; justify-content:center; align-items:center;">
              <canvas id="etsy-chart-line"></canvas>
            </div>
          </div>
          <!-- Biểu đồ Cột -->
          <div class="glass-card" style="display:flex; flex-direction:column;">
            <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">Tổng thu theo Shop</h3>
            <div style="min-height:250px; position:relative; display:flex; justify-content:center; align-items:center;">
              <canvas id="etsy-chart-bar"></canvas>
            </div>
          </div>
          <!-- Biểu đồ Tròn -->
          <div class="glass-card" style="display:flex; flex-direction:column;">
            <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">Tỷ trọng Doanh thu</h3>
            <div style="min-height:250px; position:relative; display:flex; justify-content:center; align-items:center;">
              <canvas id="etsy-chart-pie"></canvas>
            </div>
          </div>
        </div>

      </div>
    `;

    setTimeout(() => this._initEtsyCharts(Object.values(dailyMap), fShop, tongApollo, tongJolie, tongWat), 100);
  },

  _buildEtsyTableHtml(records) {
    if (records.length === 0) {
      return '<div class="glass-card" style="text-align:center; padding: 40px; color: var(--clr-text-muted);">Chưa có bản ghi nào.</div>';
    }
    
    let html = `
      <div class="glass-card" style="overflow: hidden; overflow-x: auto; padding: 0;">
        <table style="width: 100%; border-collapse: collapse; min-width: 600px; text-align: left;">
          <thead>
            <tr style="background-color: rgba(255,255,255,0.2);">
              <th style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); font-weight: 600; color: var(--clr-text-main);">Ngày</th>
              <th style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); font-weight: 600; color: var(--clr-text-main);">Shop</th>
              <th style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); font-weight: 600; color: var(--clr-text-main); text-align: right;">Số lũy kế (VNĐ)</th>
              <th style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); font-weight: 600; color: var(--clr-text-main); text-align: right;">Doanh thu phát sinh</th>
              <th style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); font-weight: 600; color: var(--clr-text-main);">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const rec of records) {
      const ngay = this._escHtml(rec.ngay || '');
      const nguon = this._escHtml(rec.nguon || '');
      const luyKe = Number(rec.so_tien).toLocaleString('vi-VN') + ' đ';
      const dtps = Number(rec.doanh_thu_phat_sinh).toLocaleString('vi-VN') + ' đ';
      const ghiChu = this._escHtml(rec.ghi_chu || '');
      
      let dtpsColorStyle = '';
      if (rec.doanh_thu_phat_sinh < 0) {
        dtpsColorStyle = 'color: #e53935; font-weight: 600; background: #ffebee; padding: 2px 6px; border-radius: 4px;';
      } else if (rec.doanh_thu_phat_sinh > 0) {
        dtpsColorStyle = 'color: #43a047; font-weight: 600;';
      } else {
        dtpsColorStyle = 'color: var(--clr-text-muted);';
      }

      html += `
        <tr style="transition: background 0.2s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
          <td style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); white-space: nowrap;">${ngay}</td>
          <td style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); font-weight: 600; color: #1a1a1a;">${nguon}</td>
          <td style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); text-align: right; font-variant-numeric: tabular-nums;">${luyKe}</td>
          <td style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); text-align: right; font-variant-numeric: tabular-nums;"><span style="${dtpsColorStyle}">${dtps}</span></td>
          <td style="padding: 14px 20px; border-bottom: 1px solid var(--clr-border); color: var(--clr-text-muted);">${ghiChu}</td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;
    return html;
  },

  _initEtsyCharts(dailyArr, fShop, tApollo, tJolie, tWat) {
    if (!window.Chart) return;
    this._etsyCharts = this._etsyCharts || {};

    dailyArr.sort((a, b) => a.parsedDate - b.parsedDate);
    const labels = dailyArr.map(d => d.date.substring(0, 5));

    // 1. Biểu đồ Đường
    if (this._etsyCharts.line) this._etsyCharts.line.destroy();
    const ctxLine = document.getElementById('etsy-chart-line');
    if (ctxLine) {
      const makeGrad = (c, r, g, b, alpha = 0.35) => {
        if (!c.chart.chartArea) return `rgba(${r},${g},${b},${alpha})`;
        const ctx = c.chart.ctx;
        const area = c.chart.chartArea;
        const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
        gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        return gradient;
      };

      let datasets = [];
      if (fShop === 'all') {
        datasets = [
          { label: 'Apollo', data: dailyArr.map(d => d.Apollo), borderColor: '#8C7355', backgroundColor: (c) => makeGrad(c, 140, 115, 85), tension: 0.4, fill: true, borderWidth: 2.5, pointBackgroundColor: '#8C7355', pointRadius: 3 },
          { label: 'Jolie', data: dailyArr.map(d => d.Jolie), borderColor: '#B7A88F', backgroundColor: (c) => makeGrad(c, 183, 168, 143), tension: 0.4, fill: true, borderWidth: 2.5, pointBackgroundColor: '#B7A88F', pointRadius: 3 },
          { label: 'WAT', data: dailyArr.map(d => d.WAT), borderColor: '#D8CBB8', backgroundColor: (c) => makeGrad(c, 216, 203, 184), tension: 0.4, fill: true, borderWidth: 2.5, pointBackgroundColor: '#D8CBB8', pointRadius: 3 }
        ];
      } else {
        const shopColors = { Apollo: { c: '#8C7355', rgb: [140, 115, 85] }, Jolie: { c: '#B7A88F', rgb: [183, 168, 143] }, WAT: { c: '#D8CBB8', rgb: [216, 203, 184] } };
        const conf = shopColors[fShop] || shopColors.Apollo;
        datasets = [
          { label: fShop, data: dailyArr.map(d => d[fShop]), borderColor: conf.c, backgroundColor: (c) => makeGrad(c, ...conf.rgb), fill: true, tension: 0.4, borderWidth: 2.5, pointBackgroundColor: conf.c, pointRadius: 3 }
        ];
      }

      this._etsyCharts.line = new Chart(ctxLine, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            tooltip: { callbacks: { label: function(c) { return c.dataset.label + ': ' + Number(c.raw).toLocaleString('vi-VN') + ' đ'; } } },
            legend: { labels: { color: '#6B5E52', font: { size: 12 }, boxWidth: 12, padding: 16 } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#9E8E82', font: { size: 11 } } },
            y: { grid: { color: 'rgba(100,80,60,0.03)', drawBorder: false }, ticks: { color: '#9E8E82', font: { size: 11 } }, beginAtZero: true }
          }
        }
      });
    }

    // 2. Biểu đồ Tròn
    if (this._etsyCharts.pie) this._etsyCharts.pie.destroy();
    const ctxPie = document.getElementById('etsy-chart-pie');
    if (ctxPie) {
      const pieData = [tApollo, tJolie, tWat].map(v => Math.max(0, v)); // Only positive for pie
      if (pieData.reduce((a,b)=>a+b, 0) > 0) {
        this._etsyCharts.pie = new Chart(ctxPie, {
          type: 'doughnut',
          data: {
            labels: ['Apollo', 'Jolie', 'WAT'],
            datasets: [{ data: pieData, backgroundColor: ['#8C7355', '#B7A88F', '#D8CBB8'], borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', hoverOffset: 6 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: '#6B5E52', font: { size: 12 }, boxWidth: 12, padding: 14 } },
              tooltip: { callbacks: { label: function(c) { return c.label + ': ' + Number(c.raw).toLocaleString('vi-VN') + ' đ'; } } }
            },
            cutout: '62%'
          }
        });
      }
    }

    // 3. Biểu đồ Cột
    if (this._etsyCharts.bar) this._etsyCharts.bar.destroy();
    const ctxBar = document.getElementById('etsy-chart-bar');
    if (ctxBar) {
      this._etsyCharts.bar = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: ['Apollo', 'Jolie', 'WAT'],
          datasets: [{ data: [tApollo, tJolie, tWat], backgroundColor: ['#8C7355', '#B7A88F', '#D8CBB8'], borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 }, borderSkipped: false }]
        },
        options: { 
          responsive: true, maintainAspectRatio: false, 
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: function(c) { return Number(c.raw).toLocaleString('vi-VN') + ' đ'; } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#9E8E82', font: { size: 11 } } },
            y: { grid: { color: 'rgba(100,80,60,0.03)', drawBorder: false }, ticks: { color: '#9E8E82', font: { size: 11 } }, beginAtZero: true }
          }
        }
      });
    }
  },

  _formatVNCurrencyInput(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    if (!val) {
      input.value = '';
      return;
    }
    input.value = Number(val).toLocaleString('vi-VN');
  },

  /**
   * Tim so luy ke gan nhat cua 1 shop TRUOC hoac DUNG ngay dang nhap.
   * Tra ve null neu shop do chua co ban ghi nao truoc thoi diem nay.
   */
  _luyKeGanNhatEtsy(shop, ngayISO) {
    const moc = ngayISO ? new Date(ngayISO + 'T23:59:59') : new Date();
    let ketQua = null;
    (this._etsyData || []).forEach(r => {
      if (r.nguon !== shop) return;
      if (r.parsedDate > moc) return;
      if (!ketQua || r.parsedDate > ketQua.parsedDate) ketQua = r;
    });
    return ketQua;
  },

  /**
   * Hien truoc doanh thu phat sinh se duoc tinh ra, ngay khi dang go.
   * Canh bao do neu so moi NHO HON lan nhap truoc (se ra doanh thu am).
   */
  _xemTruocEtsy() {
    const el = document.getElementById('etsy-xem-truoc');
    if (!el) return;
    const shop   = document.getElementById('etsy-nguon')?.value || '';
    const ngay   = document.getElementById('etsy-ngay')?.value || '';
    const soRaw  = (document.getElementById('etsy-sotien')?.value || '').replace(/[^0-9]/g, '');

    if (!soRaw) { el.textContent = ''; el.style.color = ''; return; }

    const soMoi = parseInt(soRaw, 10);
    const truoc = this._luyKeGanNhatEtsy(shop, ngay);

    if (!truoc) {
      el.style.color = 'var(--clr-text-muted)';
      el.textContent = `Bản ghi đầu tiên của ${shop} → doanh thu phát sinh = ${this._formatVND(soMoi)}`;
      return;
    }

    const chenh = soMoi - (truoc.so_tien || 0);
    if (chenh < 0) {
      el.style.color = '#C62828';
      el.textContent = `⚠ Nhỏ hơn lần nhập trước (${this._formatVND(truoc.so_tien)} ngày ${truoc.ngay}) → doanh thu sẽ ÂM ${this._formatVND(Math.abs(chenh))}. Kiểm tra lại.`;
    } else {
      el.style.color = '#2E7D32';
      el.textContent = `Doanh thu phát sinh sẽ là ${this._formatVND(chenh)} (lần trước ${this._formatVND(truoc.so_tien)} ngày ${truoc.ngay})`;
    }
  },

  async _saveDoanhThuEtsy(filterType, customFrom, customTo, fShop) {
    const ngay = document.getElementById('etsy-ngay').value;
    const nguon = document.getElementById('etsy-nguon').value;
    const soTienRaw = document.getElementById('etsy-sotien').value.replace(/[^0-9]/g, '');
    const ghiChu = document.getElementById('etsy-ghichu').value.trim();

    if (!ngay || !nguon || !soTienRaw) {
      this._showToast('Vui lòng nhập Ngày, Shop và Số lũy kế.', 'error');
      return;
    }

    // Chan nham: so luy ke moi nho hon lan truoc -> doanh thu am
    const truoc = this._luyKeGanNhatEtsy(nguon, ngay);
    if (truoc && parseInt(soTienRaw, 10) < (truoc.so_tien || 0)) {
      if (this._etsyXacNhanAm !== soTienRaw) {
        this._etsyXacNhanAm = soTienRaw;
        this._showToast('Số này NHỎ HƠN lần nhập trước — doanh thu sẽ âm. Bấm "Lưu bản ghi" lần nữa nếu vẫn muốn lưu.', 'error', 6000);
        return;
      }
    }
    this._etsyXacNhanAm = null;

    const btn = document.getElementById('btn-save-etsy');
    btn.disabled = true;
    btn.innerHTML = 'Đang lưu...';

    try {
      const soTien = parseInt(soTienRaw, 10);
      const values = [[ngay, nguon, soTien, ghiChu]];
      await this._appendSheet(CONFIG.SHEETS.DOANH_THU_KHAC, values);
      
      this._showToast('Lưu bản ghi thành công!', 'success');
      
      // Tải lại dữ liệu gốc và render lại toàn bộ theo filter hiện hành
      await this._loadEtsyData();
      this._renderEtsyContent(filterType, customFrom, customTo, fShop);
      
    } catch (error) {
      console.error(error);
      this._showToast('Lỗi khi lưu: ' + error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = 'Lưu bản ghi';
    }
  },


  // ════════════════════════════════════════════════════════════
  // MODULE: LÊN ĐƠN
  // ════════════════════════════════════════════════════════════

  async renderDonHangPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0;flex-direction:column;gap:16px;"><div class="spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(138,114,76,0.2);border-top-color:var(--clr-accent);"></div><p style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Đang tải dữ liệu...</p></div>`;

    // Tải song song danh sách đơn + nhân sự + khách hàng + danh mục
    let danhSachDon = [], nhanSuList = [], khachHangList = [];
    let danhMucNganh = [], danhMucItem = [];
    await Promise.allSettled([
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, 'A:T')
        .then(r => { danhSachDon = r || []; })
        .catch(e => console.warn('[DonHang]', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.NHAN_SU)
        .then(r => { nhanSuList = (r || []).filter(p => p.vai_tro === 'sale' || p.vai_tro === 'admin'); })
        .catch(e => console.warn('[NhanSu]', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.KHACH_HANG, 'A:I')
        .then(r => { khachHangList = r || []; })
        .catch(e => console.warn('[KhachHang]', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.DANH_MUC_NGANH)
        .then(r => { danhMucNganh = r || []; })
        .catch(e => console.warn('[DanhMucNganh]', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.DANH_MUC_ITEM)
        .then(r => { danhMucItem = r || []; })
        .catch(e => console.warn('[DanhMucItem]', e.message)),
    ]);

    this._danhMucNganh = danhMucNganh.map(r => (r.ten_nganh || '').trim()).filter(Boolean);
    this._danhMucItem = danhMucItem.map(r => (r.ten_item || '').trim()).filter(Boolean);

    this._danhSachDon  = danhSachDon;
    this._selectedFiles = [];
    this._loaiKhach    = 'moi';
    this._selectedMaKH = null;
    this._selectedTenKhach = null;

    this._khachHangList = khachHangList;

    // Danh sách khách hàng lấy trực tiếp từ KHACH_HANG
    this._uniqueKhachList = khachHangList.map(d => ({
      ma_kh: d.ma_kh,
      ten_khach: d.ten_khach || '',
      brand: d.brand || '',
      nganh: d.nganh || '',
      fanpage: d.facebook || '',
      zalo: d.zalo || '',
      sdt: d.sdt || ''
    })).sort((a, b) => a.ma_kh.localeCompare(b.ma_kh));

    const parentOpts = danhSachDon.map(d =>
      `<option value="${this._escHtml(d.ma_don)}">${this._escHtml(d.ma_don)}${d.ten_khach?' — '+this._escHtml(d.ten_khach):''}${d.brand?' ('+this._escHtml(d.brand)+')':''}</option>`
    ).join('');

    // Build sale dropdown options — mặc định chọn người đang đăng nhập
    const tenDangNhap = this.session?.ten || this.session?.name || '';
    let saleOpts;
    if (nhanSuList.length > 0) {
      saleOpts = nhanSuList.map(p => {
        const ten = p.ten || p.ho_ten || p.name || '';
        const sel = ten === tenDangNhap ? ' selected' : '';
        return `<option value="${this._escHtml(ten)}"${sel}>${this._escHtml(ten)}</option>`;
      }).join('');
      // Nếu người đăng nhập không có trong danh sách, thêm vào đầu
      const hasCurrentUser = nhanSuList.some(p => (p.ten || p.ho_ten || p.name || '') === tenDangNhap);
      if (!hasCurrentUser && tenDangNhap) {
        saleOpts = `<option value="${this._escHtml(tenDangNhap)}" selected>${this._escHtml(tenDangNhap)}</option>` + saleOpts;
      }
    } else {
      saleOpts = `<option value="${this._escHtml(tenDangNhap)}" selected>${this._escHtml(tenDangNhap)}</option>`;
    }

    content.innerHTML = `<div class="page-form-container">


  <!-- ── Thông tin khách hàng ── -->
  <div class="form-section-card">
    <div class="form-section-header">
      <div class="form-section-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
      <div><div class="form-section-title">Thông tin khách hàng</div><div class="form-section-subtitle">Chọn khách mới hoặc tìm khách đã có trong hệ thống</div></div>
    </div>

    <!-- Tab chọn loại khách -->
    <div class="khach-type-tabs">
      <button class="khach-tab-btn active" id="btn-khach-moi" onclick="App._chonLoaiKhach('moi')">+ Khách mới</button>
      <button class="khach-tab-btn" id="btn-khach-cu" onclick="App._chonLoaiKhach('cu')">&#128269; Khách cũ</button>
    </div>

    <!-- Khách mới -->
    <div id="section-khach-moi">
      <div class="form-info-note">Mã KH sẽ được tự động sinh (KH-0001, KH-0002...) và gắn với khách hàng này mãi mãi.</div>
      <div class="form-grid form-grid-1" style="margin-top:var(--space-3);">
        <div class="form-group">
          <label class="form-label" for="f-ten-khach">Tên khách hàng <span class="required">*</span></label>
          <input class="form-input" id="f-ten-khach" type="text" placeholder="Tên cá nhân hoặc doanh nghiệp" maxlength="100"/>
          <span class="form-error-msg hidden" id="err-ten-khach">Vui lòng nhập tên khách</span>
        </div>
      </div>
    </div>

    <!-- Khách cũ -->
    <div id="section-khach-cu" style="display:none;">
      <div class="form-group khach-search-wrapper">
        <label class="form-label" for="f-search-khach">Tìm khách hàng</label>
        <input class="form-input" id="f-search-khach" type="text" placeholder="Nhập tên hoặc mã KH..." oninput="App._timKhach(this.value)" autocomplete="off"/>
        <div id="khach-search-dropdown" class="khach-dropdown" style="display:none;"></div>
      </div>
      <div id="khach-da-chon" style="display:none;margin-top:var(--space-3);">
        <div class="khach-selected-card">
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span class="khach-badge" id="selected-ma-kh-badge"></span>
            <span class="khach-selected-name" id="selected-ten-khach-display"></span>
          </div>
          <button class="btn-change-khach" onclick="App._xoaChonKhach()">&#10005; Đổi khách</button>
        </div>
      </div>
      <span class="form-error-msg hidden" id="err-khach-cu" style="margin-top:var(--space-2);display:block;">Vui lòng chọn khách hàng từ danh sách</span>
    </div>

    <!-- Brand + Ngành + Liên hệ (dùng chung cho cả 2 loại) -->
    <div class="form-grid form-grid-2" style="margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--clr-border-light);">
      <div class="form-group">
        <label class="form-label" for="f-brand">Brand</label>
        <input class="form-input" id="f-brand" type="text" placeholder="Tên thương hiệu" maxlength="100"/>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-nganh">Ngành</label>
        <input class="form-input" id="f-nganh" list="nganh-list" placeholder="Chọn hoặc gõ ngành mới..." autocomplete="off"/>
        <datalist id="nganh-list">
          ${this._danhMucNganh.map(n => `<option value="${this._escHtml(n)}"/>`).join('')}
        </datalist>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-fanpage">Tên/Link Fanpage</label>
        <input class="form-input" id="f-fanpage" type="text" placeholder="facebook.com/trangcuakhach" maxlength="200"/>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-zalo">Số Zalo</label>
        <input class="form-input" id="f-zalo" type="text" placeholder="09xxxxxxxx" maxlength="20"/>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-sdt">Số điện thoại</label>
        <input class="form-input" id="f-sdt" type="text" placeholder="09xxxxxxxx" maxlength="20"/>
      </div>
    </div>
  </div>

  <!-- ── Chi tiết đơn ── -->
  <div class="form-section-card">
    <div class="form-section-header">
      <div class="form-section-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg></div>
      <div><div class="form-section-title">Chi tiết đơn hàng</div><div class="form-section-subtitle">Thông tin thiết kế và thời hạn thực hiện</div></div>
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label" for="f-item">Item thiết kế</label>
        <input class="form-input" id="f-item" list="item-list" placeholder="Chọn hoặc gõ item mới..." autocomplete="off"/>
        <datalist id="item-list">
          ${this._danhMucItem.map(i => `<option value="${this._escHtml(i)}"/>`).join('')}
        </datalist>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-ngay-het-han">Ngày hết hạn</label>
        <input class="form-input" id="f-ngay-het-han" type="date"/>
      </div>
      <div class="form-group full-width">
        <label class="form-label" for="f-brief">Brief mô tả</label>
        <textarea class="form-textarea" id="f-brief" placeholder="Mô tả yêu cầu thiết kế: phong cách, màu sắc, kích thước, tham khảo..." rows="4"></textarea>
      </div>
      <div class="form-group full-width">
        <label class="form-label" for="f-sale">Sale phụ trách</label>
        <select class="form-select" id="f-sale">${saleOpts}</select>
      </div>
    </div>
  </div>

  <!-- ── Tài chính ── -->
  <div class="form-section-card">
    <div class="form-section-header">
      <div class="form-section-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg></div>
      <div><div class="form-section-title">Tài chính</div><div class="form-section-subtitle">Giá trị đơn và tiền cọc khách đặt lúc này</div></div>
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label class="form-label" for="f-tong-gia-tri-display">Tổng giá trị đơn</label>
        <div class="money-input-wrapper">
          <input class="form-input" id="f-tong-gia-tri-display" type="text" inputmode="numeric" placeholder="0" autocomplete="off"
            oninput="App._formatMoneyInput(this,'f-tong-gia-tri')" onblur="App._formatMoneyInput(this,'f-tong-gia-tri')"/>
          <input type="hidden" id="f-tong-gia-tri" value="0"/>
          <span class="currency-symbol">VNĐ</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-coc-display">Tiền cọc lúc này</label>
        <div class="money-input-wrapper">
          <input class="form-input" id="f-coc-display" type="text" inputmode="numeric" placeholder="0 (để trống = chưa cọc)" autocomplete="off"
            oninput="App._formatMoneyInput(this,'f-coc')" onblur="App._formatMoneyInput(this,'f-coc')"/>
          <input type="hidden" id="f-coc" value="0"/>
          <span class="currency-symbol">VNĐ</span>
        </div>
      </div>
    </div>
    <div id="cong-no-preview" style="display:none;margin-top:12px;padding:10px 14px;background:var(--clr-bg);border-radius:var(--radius-sm);border:1px solid var(--clr-border-light);">
      <span style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Công nợ còn lại: </span>
      <strong id="cong-no-val" style="color:var(--clr-danger);">0 VNĐ</strong>
    </div>
  </div>

  <!-- ── Ảnh đính kèm ── -->
  <div class="form-section-card">
    <div class="form-section-header">
      <div class="form-section-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
      <div><div class="form-section-title">Ảnh đính kèm</div><div class="form-section-subtitle">Ảnh tham khảo, brief, mood board — upload lên Google Drive</div></div>
    </div>
    <div class="upload-zone" id="upload-zone">
      <input type="file" id="f-anh" multiple onchange="App._onAnhSelected(this)"/>
      <div class="upload-zone-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg></div>
      <p><strong>Click để chọn file</strong> hoặc kéo thả vào đây<small>Ảnh · PDF · Word · Excel · Video · ... · Tối đa 20 file</small></p>
    </div>
    <div id="upload-preview-grid" class="upload-preview-grid"></div>
    <div id="upload-progress-container" style="display:none;margin-top:12px;">
      <div class="upload-progress-bar"><div class="upload-progress-fill" id="upload-progress-fill" style="width:0%"></div></div>
      <p class="upload-status-text" id="upload-status-text">Đang chuẩn bị...</p>
    </div>
  </div>

  <!-- ── Đơn đặt thêm ── -->
  <div class="form-section-card">
    <div class="form-section-header" style="margin-bottom:var(--space-4);border-bottom:none;padding-bottom:0;">
      <div class="form-section-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
      <div><div class="form-section-title">Đơn đặt thêm</div><div class="form-section-subtitle">Gắn đơn này với một đơn gốc (thiết kế bổ sung trong cùng dự án)</div></div>
    </div>
    <div class="toggle-row" id="toggle-don-them" onclick="App._toggleDonDatThem()" role="button" tabindex="0">
      <div class="toggle-switch"></div>
      <span class="toggle-label">Đây là đơn đặt thêm của khách cũ</span>
    </div>
    <div class="don-cha-section" id="don-cha-section">
      <div class="form-group" style="margin-top:var(--space-3);">
        <label class="form-label" for="f-don-cha">Chọn đơn gốc</label>
        ${danhSachDon.length > 0
          ? `<select class="form-select" id="f-don-cha"><option value="">— Chọn đơn gốc —</option>${parentOpts}</select>`
          : `<div style="font-size:var(--font-size-sm);color:var(--clr-text-muted);padding:var(--space-3);background:var(--clr-bg);border-radius:var(--radius-sm);border:1px solid var(--clr-border-light);">Chưa có đơn nào để liên kết.</div>`}
      </div>
    </div>
  </div>

  <!-- ── Form Actions ── -->
  <div class="form-actions">
    <button class="btn btn-ghost" type="button" onclick="App._datLaiForm()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      Nhập lại
    </button>
    <button class="btn btn-primary btn-submit-don" id="btn-len-don" onclick="App.submitDonHang()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Lên đơn
    </button>
  </div>
  <div id="submit-result" style="display:none;"></div>

</div>`;

    this._setupUploadDragDrop();
    this._setupMoneyPreview();
    // Đóng dropdown khi click ra ngoài
    document.addEventListener('click', e => {
      if (!e.target.closest('.khach-search-wrapper')) {
        const dd = document.getElementById('khach-search-dropdown');
        if (dd) dd.style.display = 'none';
      }
    }, { once: false, capture: false });
  },


  _setupUploadDragDrop() {
    const zone = document.getElementById('upload-zone');
    if (!zone) return;
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', ()=> zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); this._addFiles(Array.from(e.dataTransfer.files)); });
  },

  _formatMoneyInput(displayEl, hiddenId) {
    // Lấy chỉ số
    const raw = displayEl.value.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10) || 0;
    // Hiển thị có dấu phẩy
    displayEl.value = raw === '' ? '' : num.toLocaleString('en-US');
    // Lưu số thuần vào hidden input
    const hidden = document.getElementById(hiddenId);
    if (hidden) hidden.value = num || 0;
    // Cập nhật preview công nợ
    this._updateCongNoPreview();
  },

  _updateCongNoPreview() {
    const total = this._parseCurrency(document.getElementById('f-tong-gia-tri')?.value);
    const coc   = this._parseCurrency(document.getElementById('f-coc')?.value);
    const prev  = document.getElementById('cong-no-preview');
    const val   = document.getElementById('cong-no-val');
    if (!prev || !val) return;
    if (total > 0) {
      prev.style.display = 'block';
      const cn = total - coc;
      val.textContent = cn.toLocaleString('vi-VN') + ' VNĐ';
      val.style.color = cn > 0 ? 'var(--clr-danger)' : 'var(--clr-success)';
    } else { prev.style.display = 'none'; }
  },

  _setupMoneyPreview() {
    // Với money fields dạng text+hidden, chỉ cần lắng nghe hidden input change
    // Preview được gọi từ _formatMoneyInput nên không cần listener riêng
  },

  _onAnhSelected(input) { this._addFiles(Array.from(input.files)); input.value = ''; },

  _addFiles(newFiles) {
    if (!this._selectedFiles) this._selectedFiles = [];
    const max = 20, remaining = max - this._selectedFiles.length;
    const toAdd = newFiles.slice(0, remaining);
    if (newFiles.length > remaining) this._showToast(`Tối đa ${max} file. Chỉ thêm ${toAdd.length} file đầu.`, 'warning');
    // Cảnh báo file > 25MB
    const MB25 = 25 * 1024 * 1024;
    const bigFiles = toAdd.filter(f => f.size > MB25).map(f => f.name);
    if (bigFiles.length > 0) {
      this._showToast(`⚠️ File quá lớn (>25MB), có thể upload chậm: ${bigFiles.slice(0,3).join(', ')}`, 'warning', 5000);
    }
    this._selectedFiles.push(...toAdd);
    this._renderPreviewGrid();
  },

  _xoaAnh(index) { if (!this._selectedFiles) return; this._selectedFiles.splice(index, 1); this._renderPreviewGrid(); },

  _renderPreviewGrid() {
    const grid = document.getElementById('upload-preview-grid');
    if (!grid) return;
    if (!this._selectedFiles?.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = this._selectedFiles.map((file, i) => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const isPdf = file.type === 'application/pdf';
      const isDoc = /\.(doc|docx)$/i.test(file.name);
      const isXls = /\.(xls|xlsx)$/i.test(file.name);
      const emoji = isPdf ? '📄' : isDoc ? '📝' : isXls ? '📊' : isVid ? '🎬' : '📎';
      const src   = isImg ? URL.createObjectURL(file) : '';
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      const bigWarn = file.size > 25*1024*1024 ? ' style="border-color:#E67E22;"' : '';
      return `<div class="upload-preview-item"${bigWarn}>
        ${isImg ? `<img src="${src}" alt="${this._escHtml(file.name)}" loading="lazy">` : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px;"><span style="font-size:26px;">${emoji}</span><span style="font-size:9px;color:var(--clr-text-muted);">${sizeMb}MB</span></div>`}
        <div class="file-name">${this._escHtml(file.name)}</div>
        <button class="remove-btn" onclick="App._xoaAnh(${i})" title="Xoá">✕</button>
      </div>`;
    }).join('');
  },

  _toggleDonDatThem() {
    const row = document.getElementById('toggle-don-them');
    const sec = document.getElementById('don-cha-section');
    if (!row || !sec) return;
    const on = row.classList.toggle('active');
    sec.classList.toggle('visible', on);
  },

  async submitDonHang() {
    // ── 1. Thu thập dữ liệu form cơ bản ──
    const brand         = document.getElementById('f-brand')?.value.trim() || '';
    const nganh         = document.getElementById('f-nganh')?.value || '';
    const item          = document.getElementById('f-item')?.value || '';
    const brief         = document.getElementById('f-brief')?.value.trim() || '';
    const ngayHetHanRaw = document.getElementById('f-ngay-het-han')?.value || '';
    const salePhuTrach  = document.getElementById('f-sale')?.value.trim() || '';
    const tongGiaTri    = this._parseCurrency(document.getElementById('f-tong-gia-tri')?.value);
    const tiencoc       = this._parseCurrency(document.getElementById('f-coc')?.value);
    const isDonThem     = document.getElementById('toggle-don-them')?.classList.contains('active');
    const donCha        = isDonThem ? (document.getElementById('f-don-cha')?.value || '') : '';
    const congNo        = (tongGiaTri || 0) - tiencoc;
    const ngayHetHan    = this._formatDateFromInput(ngayHetHanRaw);
    const ngayLenDon    = this._formatDateToday();
    
    // Thu thập thêm thông tin liên hệ
    const fanpage = document.getElementById('f-fanpage')?.value.trim() || '';
    const zalo    = document.getElementById('f-zalo')?.value.trim() || '';
    const sdt     = document.getElementById('f-sdt')?.value.trim() || '';

    let loaiKhach = this._loaiKhach || 'moi';
    let maKh, tenKhach;

    if (loaiKhach === 'cu') {
      if (!this._selectedMaKH) {
        document.getElementById('err-khach-cu')?.classList.remove('hidden');
        this._showToast('Vui lòng chọn khách hàng từ danh sách.', 'error');
        return;
      }
      maKh     = this._selectedMaKH;
      tenKhach = this._selectedTenKhach;
    } else {
      tenKhach = document.getElementById('f-ten-khach')?.value.trim();
    }

    // ── 2. Validate Trường Bắt Buộc ──
    let hasErr = false;
    if (loaiKhach === 'moi' && !tenKhach) {
      document.getElementById('f-ten-khach')?.classList.add('error');
      document.getElementById('err-ten-khach')?.classList.remove('hidden');
      hasErr = true;
    } else if (loaiKhach === 'moi') {
      document.getElementById('f-ten-khach')?.classList.remove('error');
      document.getElementById('err-ten-khach')?.classList.add('hidden');
    }

    if (!item) {
      document.getElementById('f-item')?.classList.add('error');
      hasErr = true;
    } else {
      document.getElementById('f-item')?.classList.remove('error');
    }

    if (isNaN(tongGiaTri) || tongGiaTri <= 0 || document.getElementById('f-tong-gia-tri-display')?.value.trim() === '') {
      document.getElementById('f-tong-gia-tri-display')?.classList.add('error');
      hasErr = true;
    } else {
      document.getElementById('f-tong-gia-tri-display')?.classList.remove('error');
    }

    if (hasErr) {
      this._showToast('Vui lòng nhập đầy đủ các trường bắt buộc (Tên KH, Item, Tổng giá trị).', 'error');
      return;
    }

    // ── 3. Check Trùng Lặp (Khách Mới) ──
    if (loaiKhach === 'moi') {
      const tkLower = tenKhach.toLowerCase();
      const fpLower = fanpage.toLowerCase();
      const zlLower = zalo.toLowerCase();
      const sdLower = sdt.toLowerCase();

      const match = this._uniqueKhachList.find(k => 
        (tkLower && k.ten_khach && k.ten_khach.toLowerCase().trim() === tkLower) ||
        (fpLower && k.fanpage && k.fanpage.toLowerCase().trim() === fpLower) ||
        (zlLower && k.zalo && k.zalo.toLowerCase().trim() === zlLower) ||
        (sdLower && k.sdt && k.sdt.toLowerCase().trim() === sdLower)
      );

      if (match) {
        const msg = `Thông tin trùng với khách ${match.ma_kh} - ${match.ten_khach}.\nĐây có phải khách cũ không?`;
        const useCu = await this._showConfirm(msg, 'Dùng khách cũ này', 'Vẫn tạo khách mới');
        if (useCu) {
          maKh = match.ma_kh;
          tenKhach = match.ten_khach;
          loaiKhach = 'cu';
        }
      }
    }

    // ── 4. Lock nút ──
    const btn = document.getElementById('btn-len-don');
    const origHtml = btn?.innerHTML || '';
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Đang xử lý...`; }

    try {
      // Tự sinh mã đơn
      const maDon = await this._sinhMaDon();

      // ── Xử lý KHACH_HANG ──
      const khachHangData = [maKh, tenKhach, brand, nganh, fanpage, zalo, sdt, ngayLenDon, ''];
      
      if (loaiKhach === 'moi') {
        maKh = this._sinhMaKH();
        khachHangData[0] = maKh;
        await this._appendSheet(CONFIG.SHEETS.KHACH_HANG, [khachHangData]);
        if (this._uniqueKhachList) {
          this._uniqueKhachList.unshift({ ma_kh: maKh, ten_khach: tenKhach, brand, nganh, fanpage, zalo, sdt });
        }
      } else {
        // Cập nhật thông tin khách cũ vào KHACH_HANG nếu có thay đổi
        const oldKh = this._uniqueKhachList.find(k => k.ma_kh === maKh);
        if (oldKh) {
          const isChanged = oldKh.ten_khach !== tenKhach || oldKh.brand !== brand || oldKh.nganh !== nganh || oldKh.fanpage !== fanpage || oldKh.zalo !== zalo || oldKh.sdt !== sdt;
          if (isChanged) {
            const rawKH = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.KHACH_HANG, 'A:I').catch(() => []);
            const rowIndex = rawKH.findIndex(r => r.ma_kh === maKh);
            if (rowIndex >= 0) {
              const rowNum = rowIndex + 2; // +1 for header, +1 for 0-index
              const oldRow = rawKH[rowIndex];
              const updateData = [maKh, tenKhach, brand, nganh, fanpage, zalo, sdt, oldRow.ngay_tao || ngayLenDon, oldRow.ghi_chu || ''];
              await this._writeSheet(CONFIG.SHEETS.KHACH_HANG, `A${rowNum}:I${rowNum}`, [updateData]);
            }
            // Update local cache
            Object.assign(oldKh, { ten_khach: tenKhach, brand, nganh, fanpage, zalo, sdt });
          }
        }
      }

      // Upload ảnh nếu có
      let linkAnh = '';
      if (this._selectedFiles?.length > 0) {
        const prog = document.getElementById('upload-progress-container');
        if (prog) prog.style.display = 'block';
        linkAnh = await this._uploadAnhLenDrive(this._selectedFiles, maDon);
        if (prog) prog.style.display = 'none';
      }

      // Ghi DON_HANG (không cần lưu fanpage, zalo, sdt nữa, nhưng vẫn lưu để tương thích tạm thời hoặc bỏ trống)
      // Để tránh lỗi ở các phần khác chưa migrate xong, ta ghi rỗng hoặc ghi bình thường, 
      // Nhưng theo yêu cầu, ta lưu ở KHACH_HANG là nguồn chính. Mình vẫn giữ ghi DON_HANG để an toàn.
      await this._appendSheet(CONFIG.SHEETS.DON_HANG, [[
        maDon, maKh, tenKhach, brand, nganh, item, brief, linkAnh,
        ngayLenDon, ngayHetHan, 'Đơn mới', salePhuTrach,
        tongGiaTri || 0, tiencoc, congNo, 'đang chạy', donCha,
        fanpage, zalo, sdt,
      ]]);

      // Ghi tong_gia_tri sang file Tài Chính (TIEN_DON)
      await this._saveTienDon(maDon, tongGiaTri || 0);

      // Thêm Ngành mới vào danh mục nếu chưa có
      if (nganh && this._danhMucNganh) {
        const nClean = nganh.trim();
        const nLower = nClean.toLowerCase();
        if (!this._danhMucNganh.some(x => x.toLowerCase() === nLower)) {
          const nCap = nClean.charAt(0).toUpperCase() + nClean.slice(1);
          await this._appendSheet(CONFIG.SHEETS.DANH_MUC_NGANH, [[nCap]]);
          this._danhMucNganh.push(nCap);
        }
      }

      // Thêm Item mới vào danh mục nếu chưa có
      if (item && this._danhMucItem) {
        const iClean = item.trim();
        const iLower = iClean.toLowerCase();
        if (!this._danhMucItem.some(x => x.toLowerCase() === iLower)) {
          const iCap = iClean.charAt(0).toUpperCase() + iClean.slice(1);
          await this._appendSheet(CONFIG.SHEETS.DANH_MUC_ITEM, [[iCap]]);
          this._danhMucItem.push(iCap);
        }
      }

      // Ghi GIAO_DICH_TIEN nếu có cọc: ma_don|ngay|loai|so_tien|nguon
      if (tiencoc > 0) {
        await this._appendSheet(CONFIG.SHEETS.GIAO_DICH_TIEN, [[
          maDon, ngayLenDon, 'cọc', tiencoc, 'Pixel',
        ]]);
      }

      const linkThe = `${window.location.origin}${window.location.pathname}#kanban?don=${encodeURIComponent(maDon)}`;
      const chatText = taoThongBaoChat(maDon, linkThe);

      this._hienThanhCong(maDon, tenKhach, tiencoc, congNo, chatText);
      this._showToast(`✅ Đã tạo đơn ${maDon} thành công!`, 'success', 4000);

      // Cập nhật cache local
      if (this._danhSachDon) this._danhSachDon.unshift({ ma_don: maDon, ma_kh: maKh, ten_khach: tenKhach, brand });

    } catch (err) {
      console.error('[DonHang] Lỗi lên đơn:', err);
      this._showToast(`Lỗi: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
      const prog = document.getElementById('upload-progress-container');
      if (prog) prog.style.display = 'none';
    }
  },


  // ── Sinh mã đơn ──────────────────────────────────────────
  async _sinhMaDon() {
    const rows = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG);
    if (!rows?.length) return 'DON-0001';
    let max = 0;
    rows.forEach(r => { const m = (r.ma_don||'').match(/DON-(\d+)$/); if (m) { const n = parseInt(m[1],10); if (n>max) max=n; } });
    return `DON-${String(max + 1).padStart(4, '0')}`;
  },

  // Sinh mã KH mới (dùng dữ liệu đã load trong bộ nhớ, KHÔNG gọi API)
  _sinhMaKH() {
    if (!this._danhSachDon?.length) return 'KH-0001';
    let max = 0;
    this._danhSachDon.forEach(r => {
      const m = (r.ma_kh || '').match(/KH-(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    });
    return `KH-${String(max + 1).padStart(4, '0')}`;
  },

  // ── Customer type selection ───────────────────────────────
  _chonLoaiKhach(loai) {
    const secMoi  = document.getElementById('section-khach-moi');
    const secCu   = document.getElementById('section-khach-cu');
    const btnMoi  = document.getElementById('btn-khach-moi');
    const btnCu   = document.getElementById('btn-khach-cu');
    if (!secMoi || !secCu) return;
    this._loaiKhach = loai;
    if (loai === 'moi') {
      secMoi.style.display = 'block'; secCu.style.display  = 'none';
      btnMoi?.classList.add('active'); btnCu?.classList.remove('active');
    } else {
      secMoi.style.display = 'none';  secCu.style.display  = 'block';
      btnMoi?.classList.remove('active'); btnCu?.classList.add('active');
    }
  },

  _timKhach(query) {
    const dd = document.getElementById('khach-search-dropdown');
    if (!dd) return;
    if (!query) { dd.style.display = 'none'; return; }
    const q = query.toLowerCase();
    const matches = (this._uniqueKhachList || [])
      .filter(k => k.ten_khach.toLowerCase().includes(q) || k.ma_kh.toLowerCase().includes(q))
      .slice(0, 10);
    if (!matches.length) { dd.style.display = 'none'; return; }
    dd.innerHTML = matches.map(k =>
      `<div class="khach-dropdown-item" onclick="App._chonKhachCu('${this._escHtml(k.ma_kh)}', '${this._escHtml(k.ten_khach)}')">
        <span class="khach-badge">${this._escHtml(k.ma_kh)}</span>
        <span>${this._escHtml(k.ten_khach)}</span>
      </div>`
    ).join('');
    dd.style.display = 'block';
  },

  _chonKhachCu(maKH, tenKhach) {
    this._selectedMaKH    = maKH;
    this._selectedTenKhach = tenKhach;
    const inp = document.getElementById('f-search-khach');
    if (inp) inp.value = '';
    const dd = document.getElementById('khach-search-dropdown');
    if (dd) dd.style.display = 'none';
    const badge = document.getElementById('selected-ma-kh-badge');
    const name  = document.getElementById('selected-ten-khach-display');
    if (badge) badge.textContent = maKH;
    if (name)  name.textContent  = tenKhach;
    const card = document.getElementById('khach-da-chon');
    if (card) card.style.display = 'block';
    document.getElementById('err-khach-cu')?.classList.add('hidden');

    // Tự động điền các trường dùng chung từ KHACH_HANG
    const kh = this._uniqueKhachList.find(k => k.ma_kh === maKH);
    if (kh) {
      if (document.getElementById('f-brand')) document.getElementById('f-brand').value = kh.brand || '';
      if (document.getElementById('f-nganh')) document.getElementById('f-nganh').value = kh.nganh || '';
      if (document.getElementById('f-fanpage')) document.getElementById('f-fanpage').value = kh.fanpage || '';
      if (document.getElementById('f-zalo')) document.getElementById('f-zalo').value = kh.zalo || '';
      if (document.getElementById('f-sdt')) document.getElementById('f-sdt').value = kh.sdt || '';
    }
  },

  _xoaChonKhach() {
    this._selectedMaKH    = null;
    this._selectedTenKhach = null;
    const inp = document.getElementById('f-search-khach'); if (inp) inp.value = '';
    const card = document.getElementById('khach-da-chon'); if (card) card.style.display = 'none';
    const dd = document.getElementById('khach-search-dropdown'); if (dd) dd.style.display = 'none';

    // Xóa trắng các trường dùng chung
    if (document.getElementById('f-brand')) document.getElementById('f-brand').value = '';
    if (document.getElementById('f-nganh')) document.getElementById('f-nganh').value = '';
    if (document.getElementById('f-fanpage')) document.getElementById('f-fanpage').value = '';
    if (document.getElementById('f-zalo')) document.getElementById('f-zalo').value = '';
    if (document.getElementById('f-sdt')) document.getElementById('f-sdt').value = '';
  },



  async _uploadAnhLenDrive(files, maDon) {
    const PARENT_ID = '1ZGcCJRa6CcJFT3UMUTnIZyCZaLNhpsur';
    const links = [];
    this._setUploadProgress(5, `Đang tạo thư mục ${maDon} trên Drive...`);
    const folder   = await this._taoThuMucDrive(maDon, PARENT_ID);
    const folderId = folder.id;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this._setUploadProgress(10 + Math.round((i / files.length) * 85), `Đang upload (${i+1}/${files.length}): ${file.name}`);
      try {
        const up = await this._uploadFileDrive(file, folderId);
        await this._setFilePermission(up.id).catch(()=>{});
        links.push(`https://drive.google.com/file/d/${up.id}/view`);
      } catch (e) { console.warn('[Drive] Upload lỗi:', file.name, e.message); links.push(`[Upload thất bại: ${file.name}]`); }
    }
    this._setUploadProgress(100, '✅ Upload hoàn tất!');
    return links.join('\n');
  },

  async _taoThuMucDrive(name, parentId) {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.session.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `Tạo thư mục Drive lỗi ${res.status}`); }
    return res.json();
  },

  async _uploadFileDrive(file, folderId) {
    const boundary = 'pxd_' + Date.now();
    const meta = { name: file.name, parents: [folderId], mimeType: file.type || 'application/octet-stream' };
    const buf  = await file.arrayBuffer();
    const enc  = new TextEncoder();
    const pre  = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`);
    const post = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(pre.length + buf.byteLength + post.length);
    body.set(pre, 0); body.set(new Uint8Array(buf), pre.length); body.set(post, pre.length + buf.byteLength);
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.session.accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `Upload Drive ${res.status}`); }
    return res.json();
  },

  async _setFilePermission(fileId) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.session.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  },

  _setUploadProgress(pct, text) {
    const fill = document.getElementById('upload-progress-fill');
    const txt  = document.getElementById('upload-status-text');
    if (fill) fill.style.width = `${pct}%`;
    if (txt)  txt.textContent  = text;
  },

  _hienThanhCong(maDon, tenKhach, tiencoc, congNo, chatText) {
    const result = document.getElementById('submit-result');
    if (!result) return;
    document.querySelectorAll('#page-content .form-section-card, #page-content .form-actions').forEach(el => el.style.display = 'none');
    result.style.display = 'block';
    const safeChat = this._escHtml(chatText);
    const jsonChat = JSON.stringify(chatText);
    result.innerHTML = `
      <div class="success-card">
        <div class="success-card-header">
          <div class="success-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div>
            <div class="success-title">Đã tạo đơn ${this._escHtml(maDon)} thành công!</div>
            <div class="success-subtitle">Khách: <strong>${this._escHtml(tenKhach)}</strong> &nbsp;·&nbsp; Cọc: <strong>${tiencoc>0?tiencoc.toLocaleString('vi-VN')+' VNĐ':'Chưa cọc'}</strong> &nbsp;·&nbsp; Còn nợ: <strong>${congNo.toLocaleString('vi-VN')} VNĐ</strong></div>
          </div>
        </div>
        <div class="chat-notif-box">
          <div class="chat-notif-label">📣 Thông báo Google Chat</div>
          <div class="chat-notif-text">${safeChat}</div>
          <div class="chat-notif-actions">
            <button class="btn-copy" id="btn-copy-chat" onclick="App._copyToClipboard(${jsonChat}, 'btn-copy-chat')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
            <span style="font-size:var(--font-size-xs);color:var(--clr-text-muted);align-self:center;">Dán vào Google Chat để thông báo team</span>
          </div>
        </div>
        <div style="display:flex;gap:var(--space-3);justify-content:flex-end;flex-wrap:wrap;">
          <button class="btn btn-ghost" onclick="App.renderDonHangPage()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tạo đơn mới
          </button>
          <button class="btn btn-primary" onclick="App._donTiepChoKhach()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Lưu &amp; tạo đơn tiếp cho khách này
          </button>
        </div>
      </div>`;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // Giữ lại thông tin khách, chỉ reset phần chi tiết đơn
  _donTiepChoKhach() {
    // Lưu context khách hiện tại
    const loaiKhach     = this._loaiKhach;
    const selectedMaKH  = this._selectedMaKH;
    const selectedTen   = this._selectedTenKhach;
    const tenMoi = document.getElementById('f-ten-khach')?.value || '';
    const brand  = document.getElementById('f-brand')?.value || '';
    const nganh  = document.getElementById('f-nganh')?.value || '';

    // Ẩn success card, hiện lại form
    const result = document.getElementById('submit-result');
    if (result) result.style.display = 'none';
    document.querySelectorAll('#page-content .form-section-card, #page-content .form-actions').forEach(el => el.style.display = '');

    // Khôi phục thông tin khách
    if (loaiKhach === 'cu' && selectedMaKH) {
      this._chonLoaiKhach('cu');
      this._chonKhachCu(selectedMaKH, selectedTen);
    } else {
      this._chonLoaiKhach('moi');
      const tenEl = document.getElementById('f-ten-khach');
      if (tenEl) tenEl.value = tenMoi;
    }
    const brandEl = document.getElementById('f-brand');
    if (brandEl) brandEl.value = brand;
    const nganhEl = document.getElementById('f-nganh');
    if (nganhEl) nganhEl.value = nganh;

    // Chỉ reset phần chi tiết đơn + tài chính + file
    ['f-item','f-don-cha'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const dt = document.getElementById('f-ngay-het-han'); if (dt) dt.value = '';
    const brief = document.getElementById('f-brief'); if (brief) brief.value = '';
    const tv = document.getElementById('f-tong-gia-tri-display'); if (tv) tv.value = '';
    const th = document.getElementById('f-tong-gia-tri'); if (th) th.value = '0';
    const cv = document.getElementById('f-coc-display'); if (cv) cv.value = '';
    const ch = document.getElementById('f-coc'); if (ch) ch.value = '0';
    const cn = document.getElementById('cong-no-preview'); if (cn) cn.style.display = 'none';
    document.getElementById('toggle-don-them')?.classList.remove('active');
    document.getElementById('don-cha-section')?.classList.remove('visible');
    this._selectedFiles = [];
    this._renderPreviewGrid();

    // Scroll lên đầu form
    document.querySelector('.page-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async _copyToClipboard(text, btnId) {
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.classList.add('copied');
        btn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Đã copy!`;
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"/></svg> Copy`;
        }, 2500);
      }
      this._showToast('Đã copy vào clipboard!', 'success');
    } catch { this._showToast('Không thể copy tự động — hãy copy thủ công.', 'error'); }
  },

  _datLaiForm() {
    // Reset thông tin khách hàng
    this._loaiKhach       = 'moi';
    this._selectedMaKH    = null;
    this._selectedTenKhach = null;
    this._chonLoaiKhach('moi');
    const tenEl = document.getElementById('f-ten-khach'); if (tenEl) tenEl.value = '';
    const searchEl = document.getElementById('f-search-khach'); if (searchEl) searchEl.value = '';
    const cardEl = document.getElementById('khach-da-chon'); if (cardEl) cardEl.style.display = 'none';
    const ddEl = document.getElementById('khach-search-dropdown'); if (ddEl) ddEl.style.display = 'none';

    // Reset các field còn lại
    ['f-brand','f-brief'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['f-nganh','f-item','f-don-cha'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const dt = document.getElementById('f-ngay-het-han'); if (dt) dt.value = '';
    // Reset money fields (text display + hidden)
    ['f-tong-gia-tri-display','f-coc-display'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['f-tong-gia-tri','f-coc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '0'; });
    document.querySelectorAll('.form-error-msg').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('.form-input.error,.form-select.error,.form-textarea.error').forEach(e => e.classList.remove('error'));
    document.getElementById('toggle-don-them')?.classList.remove('active');
    document.getElementById('don-cha-section')?.classList.remove('visible');
    const cn = document.getElementById('cong-no-preview'); if (cn) cn.style.display = 'none';
    this._selectedFiles = [];
    this._renderPreviewGrid();
  },


  // ════════════════════════════════════════════════════════════
  //  MÀN HÌNH KHÁCH HÀNG
  // ════════════════════════════════════════════════════════════

  async _syncKhachHang(event) {
    let btn = null;
    let oldText = '';
    if (event && event.currentTarget) {
      btn = event.currentTarget;
      oldText = btn.innerText;
      btn.innerText = 'Đang đồng bộ...';
      btn.disabled = true;
    }
    try {
      const [donRows, khRows] = await Promise.all([
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, 'A:T'),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.KHACH_HANG, 'A:I')
      ]);

      const existingKh = new Set((khRows || []).map(r => r.ma_kh));
      const missingMap = {};

      (donRows || []).forEach(d => {
        const ma = d.ma_kh;
        if (ma && !existingKh.has(ma) && !missingMap[ma]) {
          missingMap[ma] = d;
        }
      });

      const missingKeys = Object.keys(missingMap);
      if (missingKeys.length === 0) {
        if (btn) { btn.innerText = oldText; btn.disabled = false; }
        this._showToast('Mọi khách hàng đã được đồng bộ đầy đủ.', 'success');
        return;
      }

      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const ngayTao = `${dd}/${mm}/${yyyy}`;

      const newRows = [];
      missingKeys.forEach(ma => {
        const d = missingMap[ma];
        newRows.push([
          ma, // ma_kh
          d.ten_khach || '',
          d.brand || '',
          d.nganh || '',
          d.fanpage || d.facebook || '', // facebook
          d.zalo || '',
          d.sdt || '',
          ngayTao, // ngay_tao
          '' // ghi_chu
        ]);
      });

      await this._appendSheet(CONFIG.SHEETS.KHACH_HANG, newRows);
      
      if (btn) { btn.innerText = oldText; btn.disabled = false; }
      this._showToast(`✅ Đồng bộ thành công ${newRows.length} khách hàng mới!`, 'success');
      this.renderKhachHangPage(); // reload the page
    } catch (e) {
      if (btn) { btn.innerText = oldText; btn.disabled = false; }
      console.error(e);
      this._showToast(`Lỗi đồng bộ: ${e.message}`, 'error');
    }
  },

  async renderKhachHangPage() {
    const content = document.getElementById('page-content');
    content.style.padding = '24px';
    content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0;flex-direction:column;gap:16px;">
      <div class="spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(138,114,76,0.2);border-top-color:var(--clr-accent);"></div>
      <p style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Đang tải dữ liệu khách hàng...</p>
    </div>`;

    let khachHangList = [], donHangList = [];
    await Promise.allSettled([
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.KHACH_HANG, 'A:I')
        .then(r => { khachHangList = r || []; }),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, 'A:T')
        .then(r => { donHangList = r || []; }),
    ]);

    this._khachHangListFull = khachHangList;
    
    // Đếm số đơn của mỗi khách
    const donCountMap = {};
    donHangList.forEach(d => {
      const ma = d.ma_kh;
      if (ma) donCountMap[ma] = (donCountMap[ma] || 0) + 1;
    });

    this._khachHangDataView = khachHangList.map(k => ({
      ...k,
      so_don: donCountMap[k.ma_kh] || 0
    })).sort((a, b) => b.so_don - a.so_don); // Sort by order count descending
    
    this._donHangDataKhach = donHangList; // to show in detail

    this._renderKhachHangTable();
  },

  _renderKhachHangTable(q = '') {
    const content = document.getElementById('page-content');
    q = q.toLowerCase();
    
    const filtered = this._khachHangDataView.filter(k => 
      (k.ma_kh || '').toLowerCase().includes(q) ||
      (k.ten_khach || '').toLowerCase().includes(q) ||
      (k.sdt || '').toLowerCase().includes(q) ||
      (k.zalo || '').toLowerCase().includes(q)
    );

    const rows = filtered.map(k => {
      const lienHe = [];
      if (k.sdt) lienHe.push(`SĐT: ${this._escHtml(k.sdt)}`);
      if (k.zalo) lienHe.push(`Zalo: ${this._escHtml(k.zalo)}`);
      if (k.fanpage || k.facebook) lienHe.push(`FB: ${this._escHtml(k.fanpage || k.facebook)}`);
      
      return `
        <tr class="table-row-hover" style="cursor:pointer;" onclick="App._openKhachHangDetail('${this._escHtml(k.ma_kh)}')">
          <td style="padding:12px; border-bottom:1px solid var(--clr-border-light); font-weight:600; color:var(--clr-accent);">${this._escHtml(k.ma_kh)}</td>
          <td style="padding:12px; border-bottom:1px solid var(--clr-border-light); font-weight:500;">${this._escHtml(k.ten_khach)}</td>
          <td style="padding:12px; border-bottom:1px solid var(--clr-border-light);">${this._escHtml(k.brand || '—')}</td>
          <td style="padding:12px; border-bottom:1px solid var(--clr-border-light);">${this._escHtml(k.nganh || '—')}</td>
          <td style="padding:12px; border-bottom:1px solid var(--clr-border-light); font-size:12px; color:var(--clr-text-muted);">${lienHe.join('<br>') || '—'}</td>
          <td style="padding:12px; border-bottom:1px solid var(--clr-border-light); text-align:center;"><span style="display:inline-block; padding:2px 8px; background:rgba(138,114,76,0.1); border-radius:12px; font-weight:600; font-size:12px; color:var(--clr-accent);">${k.so_don} đơn</span></td>
        </tr>
      `;
    }).join('');

    const emptyState = `<tr><td colspan="6" style="padding:32px; text-align:center; color:var(--clr-text-muted);">Không tìm thấy khách hàng nào.</td></tr>`;
    
    const tbody = document.getElementById('khach-hang-tbody');
    const countEl = document.getElementById('khach-hang-count');

    if (tbody && countEl) {
      tbody.innerHTML = rows || emptyState;
      countEl.innerText = `Danh sách Khách Hàng (${filtered.length})`;
      return;
    }

    content.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; background: var(--clr-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden;">
        <div style="padding: var(--space-5); border-bottom: 1px solid var(--clr-border); display: flex; justify-content: space-between; align-items: center;">
          <h2 id="khach-hang-count" style="margin: 0; font-size: 18px; font-weight: 600;">Danh sách Khách Hàng (${filtered.length})</h2>
          <div style="display:flex; gap:12px; align-items:center;">
            ${this.session?.role === 'admin' ? `<button class="btn btn-outline btn-sm" onclick="App._syncKhachHang(event)" title="Tự động quét các khách hàng trong mục Đơn hàng chưa có trong danh sách Khách hàng">Đồng bộ khách hàng</button>` : ''}
            <div style="position:relative; width: 300px;">
              <input type="text" class="form-input khach-hang-search-input" placeholder="Tìm tên, mã KH, SĐT, Zalo..." value="${this._escHtml(q)}" oninput="App._renderKhachHangTable(this.value)" style="padding-left:36px; border-radius:20px;">
              <svg style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--clr-text-muted);" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="background: rgba(0,0,0,0.02); color: var(--clr-text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                <th style="padding:12px; border-bottom:1px solid var(--clr-border);">Mã KH</th>
                <th style="padding:12px; border-bottom:1px solid var(--clr-border);">Tên khách hàng</th>
                <th style="padding:12px; border-bottom:1px solid var(--clr-border);">Brand</th>
                <th style="padding:12px; border-bottom:1px solid var(--clr-border);">Ngành</th>
                <th style="padding:12px; border-bottom:1px solid var(--clr-border);">Liên hệ</th>
                <th style="padding:12px; border-bottom:1px solid var(--clr-border); text-align:center;">Lịch sử đặt</th>
              </tr>
            </thead>
            <tbody id="khach-hang-tbody">
              ${rows || emptyState}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
  
  _openKhachHangDetail(maKh) {
    const kh = this._khachHangListFull.find(k => k.ma_kh === maKh);
    if (!kh) return;

    // Lọc các đơn của khách
    const dons = this._donHangDataKhach.filter(d => d.ma_kh === maKh);
    const donsHtml = dons.map(d => `
      <div style="padding:10px; border:1px solid var(--clr-border-light); border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; color:var(--clr-accent);">${this._escHtml(d.ma_don)}</div>
          <div style="font-size:12px; color:var(--clr-text-muted);">${this._escHtml(d.item || '')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; color:var(--clr-text-muted);">${this._escHtml(d.ngay_len_don || '')}</div>
          <div style="font-size:12px; font-weight:600; color:${d.trang_thai === 'đang chạy' ? '#27AE60' : '#E74C3C'}">${this._escHtml(d.trang_thai || '')}</div>
        </div>
      </div>
    `).join('');

    const overlay = document.createElement('div');
    overlay.id = 'kh-detail-overlay';
    overlay.className = 'kb-overlay';
    overlay.innerHTML = `
      <div class="kb-detail-modal" style="max-width: 800px;">
        <div class="kb-detail-header">
          <div>
            <div class="kb-detail-id">Hồ sơ khách hàng: ${this._escHtml(kh.ma_kh)}</div>
            <div class="kb-detail-khach">Cập nhật lúc: ${this._formatDateToday()}</div>
          </div>
          <button class="kb-detail-close" onclick="App._closeKhDetail()">✕</button>
        </div>

        <div class="kb-detail-body" style="grid-template-columns: 1fr 300px; padding-top: 16px;">
          <!-- Cột trái: Chỉnh sửa thông tin -->
          <div class="kb-detail-left">
            <h3 style="margin-top:0; margin-bottom:16px; font-size:16px; font-weight:600; border-bottom:1px solid var(--clr-border-light); padding-bottom:8px;">Thông tin cơ bản</h3>
            
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Tên khách hàng</label>
                <input type="text" class="form-input" id="kh-det-ten" value="${this._escHtml(kh.ten_khach)}">
              </div>
              <div class="form-group">
                <label class="form-label">Brand</label>
                <input type="text" class="form-input" id="kh-det-brand" value="${this._escHtml(kh.brand)}">
              </div>
              <div class="form-group">
                <label class="form-label">Ngành</label>
                <input type="text" class="form-input" id="kh-det-nganh" value="${this._escHtml(kh.nganh)}">
              </div>
            </div>

            <h3 style="margin-top:24px; margin-bottom:16px; font-size:16px; font-weight:600; border-bottom:1px solid var(--clr-border-light); padding-bottom:8px;">Thông tin liên hệ</h3>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label">Facebook/Fanpage</label>
                <input type="text" class="form-input" id="kh-det-fanpage" value="${this._escHtml(kh.fanpage || kh.facebook || '')}">
              </div>
              <div class="form-group">
                <label class="form-label">Số Zalo</label>
                <input type="text" class="form-input" id="kh-det-zalo" value="${this._escHtml(kh.zalo)}">
              </div>
              <div class="form-group">
                <label class="form-label">Số điện thoại</label>
                <input type="text" class="form-input" id="kh-det-sdt" value="${this._escHtml(kh.sdt)}">
              </div>
            </div>
            
            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label">Ghi chú</label>
              <textarea class="form-textarea" id="kh-det-ghichu" rows="3">${this._escHtml(kh.ghi_chu || '')}</textarea>
            </div>
          </div>

          <!-- Cột phải: Lịch sử đơn hàng -->
          <div class="kb-detail-right" style="border-left: 1px solid var(--clr-border-light); padding-left: 20px;">
            <div class="kb-detail-section-title">Lịch sử đơn hàng (${dons.length})</div>
            <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">
              ${donsHtml || '<div style="font-size:12px;color:var(--clr-text-muted);">Khách chưa có đơn hàng nào.</div>'}
            </div>
          </div>
        </div>

        <div class="kb-detail-footer">
          <button class="btn btn-ghost" onclick="App._closeKhDetail()">Đóng</button>
          <button class="btn btn-primary" id="btn-save-kh" onclick="App._saveKhDetail('${this._escHtml(kh.ma_kh)}')">
            Lưu thay đổi
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeKhDetail(); });
    requestAnimationFrame(() => overlay.classList.add('kb-overlay-visible'));
  },

  _closeKhDetail() {
    const overlay = document.getElementById('kh-detail-overlay');
    if (!overlay) return;
    overlay.classList.remove('kb-overlay-visible');
    setTimeout(() => overlay.remove(), 250);
  },

  async _saveKhDetail(maKh) {
    const btn = document.getElementById('btn-save-kh');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Đang lưu...'; }

    try {
      const ten_khach = document.getElementById('kh-det-ten').value.trim();
      const brand = document.getElementById('kh-det-brand').value.trim();
      const nganh = document.getElementById('kh-det-nganh').value.trim();
      const fanpage = document.getElementById('kh-det-fanpage').value.trim();
      const zalo = document.getElementById('kh-det-zalo').value.trim();
      const sdt = document.getElementById('kh-det-sdt').value.trim();
      const ghi_chu = document.getElementById('kh-det-ghichu').value.trim();

      const rawKH = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.KHACH_HANG, 'A:I');
      const rowIndex = rawKH.findIndex(r => r.ma_kh === maKh);
      
      if (rowIndex >= 0) {
        const rowNum = rowIndex + 2; // +1 for header, +1 for 0-index
        const oldRow = rawKH[rowIndex];
        const updateData = [
          maKh, ten_khach, brand, nganh, fanpage, zalo, sdt, 
          oldRow.ngay_tao || this._formatDateToday(), 
          ghi_chu
        ];
        
        await this._writeSheet(CONFIG.SHEETS.KHACH_HANG, `A${rowNum}:I${rowNum}`, [updateData]);
        this._showToast('Đã lưu hồ sơ khách hàng!', 'success');
        
        // Update local cache
        const khIndex = this._khachHangListFull.findIndex(k => k.ma_kh === maKh);
        if (khIndex >= 0) {
          this._khachHangListFull[khIndex] = {
            ...this._khachHangListFull[khIndex],
            ten_khach, brand, nganh, fanpage, zalo, sdt, ghi_chu
          };
        }
        
        // Refresh view data array
        const viewIndex = this._khachHangDataView.findIndex(k => k.ma_kh === maKh);
        if (viewIndex >= 0) {
          this._khachHangDataView[viewIndex] = {
            ...this._khachHangDataView[viewIndex],
            ten_khach, brand, nganh, fanpage, zalo, sdt, ghi_chu
          };
        }
        
        // Refresh table if searching
        const searchInput = document.querySelector('.khach-hang-search-input');
        this._renderKhachHangTable(searchInput ? searchInput.value : '');
        this._closeKhDetail();
      } else {
        throw new Error("Không tìm thấy dòng khách hàng trong Google Sheets!");
      }
      
    } catch (err) {
      console.error(err);
      this._showToast('Lỗi lưu khách hàng: ' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Lưu thay đổi'; }
    }
  },

  _formatDateToday() {
    const n = new Date();
    return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`;
  },

  _formatDateFromInput(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  },

  _formatDateInput(dateObj) {
    if (!dateObj) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  _formatNumber(num) {
    if (isNaN(num)) return '0';
    return Number(num).toLocaleString('vi-VN');
  },

  _formatVND(num) {
    if (isNaN(num)) return '0 đ';
    return this._formatNumber(num) + ' đ';
  },

  _parseCurrency(val) {
    if (val === undefined || val === null || val === '') return 0;
    // Bỏ tất cả dấu phẩy, dấu chấm, khoảng trắng
    // Ví dụ: 150.000 -> 150000, 1.500.000,00 -> 150000000
    // Wait, regex [^0-9-] removes dots and commas. So "149.850" becomes "149850"
    const cleaned = val.toString().replace(/[^0-9-]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  },

  // ════════════════════════════════════════════════════════════
  //  MÀN HÌNH DOANH THU PIXEL
  // ════════════════════════════════════════════════════════════

  async renderDoanhThuPage() {
    const content = document.getElementById('page-content');
    content.style.padding = '24px';
    content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0;flex-direction:column;gap:16px;">
      <div class="spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(138,114,76,0.2);border-top-color:var(--clr-accent);"></div>
      <p style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Đang tải dữ liệu doanh thu...</p>
    </div>`;

    try {
      const [gdData, donData, danhMucNganh, danhMucItem, tienDonData] = await Promise.all([
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.GIAO_DICH_TIEN, 'A:E'),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, 'A:T'),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DANH_MUC_NGANH),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DANH_MUC_ITEM),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.TIEN_DON, 'A:B').catch(() => [])
      ]);

      this._doanhThuData = gdData || [];
      const donHangList = donData || [];
      const tienDonList = tienDonData || [];
      
      const tienDonMap = {};
      tienDonList.forEach(row => { if (row.ma_don) tienDonMap[row.ma_don] = row.tong_gia_tri; });
      donHangList.forEach(d => { if (tienDonMap[d.ma_don] !== undefined) d.tong_gia_tri = tienDonMap[d.ma_don]; });
      
      const donMap = {};
      donHangList.forEach(d => {
        if (d.ma_don) {
          donMap[d.ma_don] = {
            nganh: d.nganh || '',
            sale_phu_trach: d.sale_phu_trach || '',
            ma_kh: d.ma_kh || '',
            item: d.item || ''
          };
        }
      });

      const uniqueSale = new Set();
      const uniqueKh = new Set();
      const uniqueLoai = new Set();

      this._doanhThuData.forEach(r => {
        if (r.ngay) {
          const [d, m, y] = r.ngay.split('/');
          r.parsedDate = new Date(y, m - 1, d);
        } else {
          r.parsedDate = new Date(0);
        }
        r.so_tien = this._parseCurrency(r.so_tien);

        const donInfo = donMap[r.ma_don] || {};
        r.nganh = donInfo.nganh;
        r.sale_phu_trach = donInfo.sale_phu_trach;
        r.ma_kh = donInfo.ma_kh;
        r.item = donInfo.item;

        if (r.sale_phu_trach) uniqueSale.add(r.sale_phu_trach);
        if (r.ma_kh) uniqueKh.add(r.ma_kh);
        if (r.loai) uniqueLoai.add(r.loai);
      });

      this._doanhThuFilters = {
        nganh: (danhMucNganh || []).map(r => r.ten_nganh).filter(Boolean),
        sale: Array.from(uniqueSale).sort(),
        kh: Array.from(uniqueKh).sort(),
        item: (danhMucItem || []).map(r => r.ten_item).filter(Boolean),
        loai: Array.from(uniqueLoai).sort()
      };

      this._renderDoanhThuContent('month'); // default to this month
    } catch (e) {
      console.error(e);
      content.innerHTML = `<div style="color:var(--clr-error); padding:24px;">Lỗi tải dữ liệu: ${this._escHtml(e.message)}</div>`;
    }
  },

  _tinhSoTienGiam(don) {
    if (!don) return 0;
    const tongGiaTri = this._parseCurrency(don.tong_gia_tri);
    if (tongGiaTri <= 0) return 0;
    
    const loaiGiam = (don.giam_gia_loai || '').trim();
    if (!loaiGiam) return 0;
    
    let giaTriGiam = 0;
    if (loaiGiam === 'amount') {
       giaTriGiam = this._parseCurrency(don.giam_gia_gia_tri);
    } else if (loaiGiam === 'percent') {
       // Allow decimal percentages
       const percentStr = (don.giam_gia_gia_tri || '').toString().replace(/,/g, '.');
       const percent = parseFloat(percentStr);
       if (!isNaN(percent) && percent > 0 && percent <= 100) {
          giaTriGiam = Math.round(tongGiaTri * (percent / 100));
       }
    }
    
    if (giaTriGiam < 0) return 0;
    if (giaTriGiam > tongGiaTri) return tongGiaTri; // Max discount is 100%
    return giaTriGiam;
  },

  _tinhSoPhaiThu(don) {
    if (!don) return 0;
    const tongGiaTri = this._parseCurrency(don.tong_gia_tri);
    if (tongGiaTri <= 0) return 0;
    
    const giamGia = this._tinhSoTienGiam(don);
    const phaiThu = tongGiaTri - giamGia;
    return phaiThu < 0 ? 0 : phaiThu;
  },

  _showChiTietHoan() {
    if (!this._doanhThuCurrentFilteredData) return;
    
    // 1. Lọc giao dịch hoàn trong kỳ
    const hoanList = this._doanhThuCurrentFilteredData.filter(r => r.so_tien < 0);
    
    let totalHoan = 0;
    
    // 2. Build HTML cho từng dòng
    const htmlRows = hoanList.map(r => {
      const tienHoan = Math.abs(r.so_tien);
      totalHoan += tienHoan;
      
      let khachHang = 'Không rõ';
      if (this._doanhThuDonHangList) {
         const don = this._doanhThuDonHangList.find(d => d.ma_don === r.ma_don);
         if (don) {
            khachHang = don.ten_khach_hang || don.ten_khach || don.brand || 'Không rõ';
         }
      }
      
      return `
        <tr>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); font-weight:600; color:#4A4036;">${this._escHtml(r.ma_don || '')}</td>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); color:#5C544D;">${this._escHtml(khachHang)}</td>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); color:#C62828; font-weight:700; text-align:right;">${this._formatVND(tienHoan)}</td>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); text-align:right; color:#8A724C;">${this._escHtml(r.ngay || '')}</td>
        </tr>
      `;
    }).join('');

    const emptyHtml = `<tr><td colspan="4" style="text-align:center; padding:48px 16px; color:#8A724C; font-style:italic;">Kỳ này không có khoản hoàn nào.</td></tr>`;

    // 3. Dựng cấu trúc Popup
    const modalHtml = `
      <div id="modal-chitiet-hoan" style="position:fixed; inset:0; background:rgba(42,36,32,0.4); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.25s ease-out;">
        <div style="background:#FAF8F5; width:100%; max-width:800px; border-radius:24px; box-shadow:0 24px 48px rgba(42,36,32,0.12), 0 0 0 1px rgba(138,114,76,0.1); display:flex; flex-direction:column; max-height:90vh; overflow:hidden;">
          
          <div style="padding:24px 32px; background:linear-gradient(to right, #FAF8F5, #FFF); display:flex; justify-content:space-between; align-items:center; position:relative;">
            <h3 style="margin:0; font-size:20px; color:#2A2420; font-weight:800; letter-spacing:-0.3px;">Chi tiết hoàn tiền</h3>
            <button onclick="document.getElementById('modal-chitiet-hoan').remove()" style="background:rgba(138,114,76,0.08); border:none; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#8A724C; transition:all 0.2s;" onmouseover="this.style.background='rgba(138,114,76,0.15)'" onmouseout="this.style.background='rgba(138,114,76,0.08)'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div style="padding:0 32px 16px 32px; background:linear-gradient(to right, #FAF8F5, #FFF);">
            <div style="background:linear-gradient(135deg, #FFF6EF, #FDF0F4); border-radius:12px; padding:12px 16px; display:flex; gap:12px; align-items:flex-start; box-shadow:inset 0 0 0 1px rgba(138,114,76,0.1);">
              <div style="color:#8A724C; margin-top:2px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              </div>
              <div style="font-size:13px; color:#5C544D; line-height:1.5;">Khoản hoàn được ghi nhận vào tháng thực hiện hoàn tiền (theo ngày hoàn), không điều chỉnh ngược lại doanh thu tháng phát sinh đơn.</div>
            </div>
          </div>
          
          <div style="flex:1; overflow-y:auto; padding:0 32px 16px 32px; background:#FFF;">
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
              <thead style="position:sticky; top:0; z-index:2; background:#FFF;">
                <tr>
                  <th style="padding:12px 24px; text-align:left; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Mã đơn</th>
                  <th style="padding:12px 24px; text-align:left; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Khách hàng</th>
                  <th style="padding:12px 24px; text-align:right; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Số tiền hoàn</th>
                  <th style="padding:12px 24px; text-align:right; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Ngày hoàn</th>
                </tr>
              </thead>
              <tbody>
                ${hoanList.length > 0 ? htmlRows : emptyHtml}
              </tbody>
            </table>
          </div>
          
          <div style="padding:24px 32px; background:linear-gradient(to right, #FFEBEE, #FDE0E4); display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:700; color:#C62828; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Tổng tiền hoàn</div>
            <div style="font-weight:800; color:#B71C1C; font-size:24px;">${this._formatVND(totalHoan)}</div>
          </div>
          
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  _showDonKhongDong() {
    const list = this._zeroValueOrdersFiltered || [];
    
    // Build HTML cho từng dòng
    const htmlRows = list.map(don => {
      const isCancelled = don.trang_thai && don.trang_thai.toLowerCase().startsWith('hủy');
      const khachHang = don.ten_khach_hang || don.ten_khach || don.brand || 'Không rõ';
      const sale = don.sale_phu_trach || 'Không rõ';
      const trangThaiHtml = isCancelled 
        ? `<span style="color:#D32F2F; font-weight:700; background:rgba(211,47,47,0.1); padding:4px 8px; border-radius:4px;">${this._escHtml(don.trang_thai)}</span>`
        : `<span style="color:#388E3C; font-weight:600;">${this._escHtml(don.trang_thai || 'Đang chạy')}</span>`;
        
      return `
        <tr>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); font-weight:600; color:#4A4036;">${this._escHtml(don.ma_don || '')}</td>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); color:#5C544D;">${this._escHtml(khachHang)}</td>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); color:#1565C0; font-weight:600;">${this._escHtml(sale)}</td>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); text-align:right; color:#8A724C;">${this._escHtml(don.ngay_len_don || don.ngay_tao || '')}</td>
          <td style="padding:16px 24px; border-bottom:1px solid rgba(138,114,76,0.1); text-align:right;">${trangThaiHtml}</td>
        </tr>
      `;
    }).join('');

    const emptyHtml = `<tr><td colspan="5" style="text-align:center; padding:48px 16px; color:#8A724C; font-style:italic;">Không có đơn giá trị 0đ nào.</td></tr>`;

    // Dựng cấu trúc Popup
    const modalHtml = `
      <div id="modal-don-khong-dong" style="position:fixed; inset:0; background:rgba(42,36,32,0.4); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.25s ease-out;">
        <div style="background:#FAF8F5; width:100%; max-width:900px; border-radius:24px; box-shadow:0 24px 48px rgba(42,36,32,0.12), 0 0 0 1px rgba(138,114,76,0.1); display:flex; flex-direction:column; max-height:90vh; overflow:hidden;">
          
          <div style="padding:24px 32px; background:linear-gradient(to right, #FAF8F5, #FFF); display:flex; justify-content:space-between; align-items:center; position:relative;">
            <h3 style="margin:0; font-size:20px; color:#2A2420; font-weight:800; letter-spacing:-0.3px;">Chi tiết Đơn giá trị 0đ</h3>
            <button onclick="document.getElementById('modal-don-khong-dong').remove()" style="background:rgba(138,114,76,0.08); border:none; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#8A724C; transition:all 0.2s;" onmouseover="this.style.background='rgba(138,114,76,0.15)'" onmouseout="this.style.background='rgba(138,114,76,0.08)'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div style="padding:0 32px 16px 32px; background:linear-gradient(to right, #FAF8F5, #FFF);">
            <div style="background:linear-gradient(135deg, #FFEBEE, #FDE0E4); border-radius:12px; padding:12px 16px; display:flex; gap:12px; align-items:flex-start; box-shadow:inset 0 0 0 1px rgba(229,115,115,0.3);">
              <div style="color:#C62828; margin-top:2px;">
                <span style="font-size:16px;">⚠️</span>
              </div>
              <div style="font-size:13px; color:#B71C1C; line-height:1.5;">Rà soát các đơn giá trị 0đ để đảm bảo không bỏ sót doanh thu (tránh trường hợp sale đổi trạng thái hủy để giấu doanh thu).</div>
            </div>
          </div>
          
          <div style="flex:1; overflow-y:auto; padding:0 32px 16px 32px; background:#FFF;">
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
              <thead style="position:sticky; top:0; z-index:2; background:#FFF;">
                <tr>
                  <th style="padding:12px 24px; text-align:left; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Mã đơn</th>
                  <th style="padding:12px 24px; text-align:left; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Khách hàng</th>
                  <th style="padding:12px 24px; text-align:left; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Sale phụ trách</th>
                  <th style="padding:12px 24px; text-align:right; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Ngày lên đơn</th>
                  <th style="padding:12px 24px; text-align:right; font-weight:600; color:#8A724C; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; border-bottom:1px solid rgba(138,114,76,0.15);">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${list.length > 0 ? htmlRows : emptyHtml}
              </tbody>
            </table>
          </div>
          
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  _renderDoanhThuContent(filterType = 'month', customFrom = '', customTo = '', fNganh = 'all', fSale = 'all', fKh = 'all', fItem = 'all', fLoai = 'all') {
    const content = document.getElementById('page-content');
    const today = new Date();
    let startDate, endDate;

    if (filterType === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterType === 'last_month') {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    } else if (filterType === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      startDate = new Date(today.getFullYear(), q * 3, 1);
      endDate = new Date(today.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
    } else if (filterType === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filterType === 'custom') {
      startDate = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(0);
      endDate = customTo ? new Date(customTo + 'T23:59:59') : new Date('2999-12-31');
    }

    let tongDoanhThu = 0;
    let tongThu = 0;
    let tongHoan = 0;
    let tongTip = 0;
    let soGiaoDich = 0;
    
    let trendMap = {}; // Lưu dữ liệu biểu đồ xu hướng theo ngày lên đơn

    let tongThuDonKy = 0;
    let tongThuNoCu = 0;
    let congNo = 0;
    let soDon = 0;

    const dailyMap = {};
    this._doanhThuCurrentFilteredData = [];

    const parseDateStr = (dateStr) => {
      if (!dateStr) return null;
      const parts = dateStr.trim().split('/');
      if (parts.length < 2) return null;
      let d = 1, m, y;
      if (parts.length === 2) { 
         d = 1; m = parseInt(parts[0], 10); y = parseInt(parts[1], 10);
      } else {
         d = parseInt(parts[0], 10); m = parseInt(parts[1], 10); y = parseInt(parts[2], 10);
      }
      if (isNaN(y) || y < 1970) y = today.getFullYear();
      if (isNaN(m) || m < 1 || m > 12) return null;
      return new Date(y, m - 1, d);
    };

    this._doanhThuData.forEach(r => {
      if (r.parsedDate < startDate || r.parsedDate > endDate) return;

      if (fNganh !== 'all' && r.nganh !== fNganh) return;
      if (fSale !== 'all' && r.sale_phu_trach !== fSale) return;
      if (fKh !== 'all' && r.ma_kh !== fKh) return;
      if (fItem !== 'all' && r.item !== fItem) return;
      if (fLoai !== 'all' && r.loai !== fLoai) return;

      const tien = r.so_tien;
      const isTip = r.loai && r.loai.toLowerCase() === 'tip';

      if (tien < 0) tongHoan += Math.abs(tien);
      if (isTip) tongTip += tien;

      if (tien > 0 && !isTip) {
         const donHang = (this._doanhThuDonHangList || []).find(d => d.ma_don === r.ma_don);
         if (donHang) {
            const ngayLenDonDate = parseDateStr(donHang.ngay_len_don || donHang.ngay_tao || '');
            if (ngayLenDonDate && ngayLenDonDate < startDate) {
               tongThuNoCu += tien;
            }
         }
      }

      const dateStr = r.ngay || 'Chưa rõ';
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, parsedDate: r.parsedDate, total: 0, count: 0 };
      }
      dailyMap[dateStr].total += tien;
      dailyMap[dateStr].count += 1;
      this._doanhThuCurrentFilteredData.push(r);
    });

    this._zeroValueOrdersFiltered = [];
    (this._doanhThuDonHangList || []).forEach(don => {
       if (fNganh !== 'all' && (don.nganh || '') !== fNganh) return;
       if (fSale !== 'all' && (don.sale_phu_trach || '') !== fSale) return;
       if (fKh !== 'all' && (don.ma_kh || '') !== fKh) return;
       if (fItem !== 'all' && (don.item || '') !== fItem) return;

       const ngayLenDonDate = parseDateStr(don.ngay_len_don || don.ngay_tao || '');
       if (!ngayLenDonDate) return;

       if (ngayLenDonDate >= startDate && ngayLenDonDate <= endDate) {
          soDon++;
          const soPhaiThu = this._tinhSoPhaiThu(don);
          tongDoanhThu += soPhaiThu;

          let daThucThuThatSu = 0;
          let daThucThuFilter = 0;
          const gdCuaDon = this._doanhThuData.filter(r => r.ma_don === don.ma_don);
          gdCuaDon.forEach(r => {
             const isTip = r.loai && r.loai.toLowerCase() === 'tip';
             if (r.so_tien > 0 && !isTip) {
                daThucThuThatSu += r.so_tien;
                if (fLoai === 'all' || r.loai === fLoai) {
                   daThucThuFilter += r.so_tien;
                }
             }
          });
          
          tongThuDonKy += daThucThuFilter;

          let no = soPhaiThu - daThucThuThatSu;
          if (no > 0) congNo += no;

          if (don.da_an !== 'yes' && this._parseCurrency(don.tong_gia_tri) <= 0) {
             if (!this._zeroValueOrdersFiltered) this._zeroValueOrdersFiltered = [];
             this._zeroValueOrdersFiltered.push(don);
          }
          
          if (don.da_an !== 'yes') {
             const d = ngayLenDonDate.getDate();
             const m = ngayLenDonDate.getMonth() + 1;
             const y = ngayLenDonDate.getFullYear();
             const dateStr = `${d < 10 ? '0'+d : d}/${m < 10 ? '0'+m : m}/${y}`;
             if (!trendMap[dateStr]) {
                trendMap[dateStr] = { date: dateStr, parsedDate: ngayLenDonDate, total: 0 };
             }
             trendMap[dateStr].total += soPhaiThu;
          }
       }
    });

    tongThu = tongThuDonKy + tongThuNoCu;
    soGiaoDich = soDon;

    // Sắp xếp ngày từ mới nhất đến cũ nhất (mới nhất ở trên)
    const dailyArr = Object.values(dailyMap).sort((a, b) => b.parsedDate - a.parsedDate);
    
    // Lưu tạm cho tính năng xuất Excel
    this._doanhThuCurrentExport = dailyArr;

    const btnStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-border-light); background:var(--clr-surface); cursor:pointer; font-size:13px; font-weight:500; color:var(--clr-text); transition:all 0.2s;";
    const btnActiveStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-accent); background:var(--clr-accent); color:#fff; cursor:pointer; font-size:13px; font-weight:500; transition:all 0.2s;";
    const selectStyle = "padding:6px 10px; border-radius:8px; border:1px solid var(--clr-border-light); font-size:13px; background:var(--clr-surface); max-width:150px;";

    const buildOptions = (arr, currentVal) => {
      let html = `<option value="all">Tất cả</option>`;
      arr.forEach(item => {
        const selected = item === currentVal ? 'selected' : '';
        html += `<option value="${this._escHtml(item)}" ${selected}>${this._escHtml(item)}</option>`;
      });
      return html;
    };

    const filterOnChange = `App._renderDoanhThuContent('${filterType}', '${customFrom}', '${customTo}', document.getElementById('dt-nganh').value, document.getElementById('dt-sale').value, document.getElementById('dt-kh').value, document.getElementById('dt-item').value, document.getElementById('dt-loai').value)`;
    const resetFilterClick = `App._renderDoanhThuContent('month', '', '', 'all', 'all', 'all', 'all', 'all')`;

    content.innerHTML = `
      <div id="dt-content-wrap" style="max-width: 1200px; margin: 0 auto; display:flex; flex-direction:column; gap:24px;">
        
        <!-- BỘ LỌC -->
        <div style="background:var(--clr-card); padding:20px; border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:16px;">
          
          <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button style="${filterType === 'month' ? btnActiveStyle : btnStyle}" onclick="App._renderDoanhThuContent('month', '', '', '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Tháng này</button>
              <button style="${filterType === 'last_month' ? btnActiveStyle : btnStyle}" onclick="App._renderDoanhThuContent('last_month', '', '', '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Tháng trước</button>
              <button style="${filterType === 'quarter' ? btnActiveStyle : btnStyle}" onclick="App._renderDoanhThuContent('quarter', '', '', '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Quý này</button>
              <button style="${filterType === 'year' ? btnActiveStyle : btnStyle}" onclick="App._renderDoanhThuContent('year', '', '', '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Năm nay</button>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end;">
              <span style="font-size:14px; font-weight:500; width:100%;">Hoặc chọn ngày:</span>
              <div style="display:flex; gap:8px; align-items:flex-end; flex:1 1 auto;">
                <div style="display:flex; flex-direction:column; gap:4px; flex:1 1 0;">
                  <label for="dt-from" style="font-size:12px; font-style:italic; color:var(--clr-text-muted);">Từ ngày</label>
                  <input type="date" id="dt-from" class="form-input" style="width:100%; padding:6px 10px;" value="${customFrom}">
                </div>
                <span style="color:var(--clr-text-muted); align-self:center; padding-bottom:6px;">-</span>
                <div style="display:flex; flex-direction:column; gap:4px; flex:1 1 0;">
                  <label for="dt-to" style="font-size:12px; font-style:italic; color:var(--clr-text-muted);">Đến ngày</label>
                  <input type="date" id="dt-to" class="form-input" style="width:100%; padding:6px 10px;" value="${customTo}">
                </div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="App._renderDoanhThuContent('custom', document.getElementById('dt-from').value, document.getElementById('dt-to').value, '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Lọc</button>
            </div>
          </div>

          <div style="border-top:1px dashed var(--clr-border-light); margin:4px 0;"></div>

          <!-- BỘ LỌC KẾT HỢP -->
          <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Ngành:</label>
              <select id="dt-nganh" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._doanhThuFilters.nganh, fNganh)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Sale:</label>
              <select id="dt-sale" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._doanhThuFilters.sale, fSale)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Mã KH:</label>
              <select id="dt-kh" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._doanhThuFilters.kh, fKh)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Item:</label>
              <select id="dt-item" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._doanhThuFilters.item, fItem)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Loại giao dịch:</label>
              <select id="dt-loai" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._doanhThuFilters.loai, fLoai)}
              </select>
            </div>
            <div style="flex-grow:1; text-align:right;">
              <button class="btn btn-ghost btn-sm" onclick="${resetFilterClick}" style="color:var(--clr-error);">Xóa bộ lọc</button>
            </div>
          </div>
        </div>

        <!-- CHỈ SỐ TỔNG -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
          <div style="background:linear-gradient(135deg, #EDE7F6, #F3EFFB); padding:20px; border-radius:20px; box-shadow:var(--shadow-sm);">
            <div style="font-size:13px; color:var(--clr-text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px; margin-bottom:8px;">Tổng doanh thu</div>
            <div style="font-size:28px; font-weight:800; color:#2A2420;">${this._formatVND(tongDoanhThu)}</div>
          </div>
          <div style="background:linear-gradient(135deg, #FCE4EC, #FDF0F4); padding:20px; border-radius:20px; box-shadow:var(--shadow-sm);">
            <div style="font-size:13px; color:var(--clr-text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px; margin-bottom:8px;">Tổng thu</div>
            <div style="font-size:28px; font-weight:800; color:#2A2420;">${this._formatVND(tongThu)}</div>
            <div style="font-size:11px; color:var(--clr-text-muted); margin-top:8px; font-weight:500;">Đơn tháng này: ${this._formatVND(tongThuDonKy)} &middot; Thu nợ cũ: ${this._formatVND(tongThuNoCu)}</div>
          </div>
          <div onclick="App._showChiTietHoan()" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)'" style="background:linear-gradient(135deg, #FFF0E5, #FFF6EF); padding:20px; border-radius:20px; box-shadow:var(--shadow-sm); cursor:pointer; transition:all 0.2s;" title="Bấm xem chi tiết">
            <div style="font-size:13px; color:var(--clr-text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
               Tổng hoàn <span style="display:flex; align-items:center; opacity:0.6;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>
            </div>
            <div style="font-size:28px; font-weight:800; color:#2A2420;">${this._formatVND(tongHoan)}</div>
          </div>
          <div style="background:linear-gradient(135deg, #FFEBEE, #FDE0E4); padding:20px; border-radius:20px; box-shadow:var(--shadow-sm);">
            <div style="font-size:13px; color:#C62828; text-transform:uppercase; font-weight:600; letter-spacing:0.5px; margin-bottom:8px;">Công nợ</div>
            <div style="font-size:28px; font-weight:800; color:#B71C1C;">${this._formatVND(congNo)}</div>
          </div>
          <div style="background:linear-gradient(135deg, #EDE7F6, #F3EFFB); padding:20px; border-radius:20px; box-shadow:var(--shadow-sm);">
            <div style="font-size:13px; color:var(--clr-text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.5px; margin-bottom:8px;">Số đơn</div>
            <div style="font-size:28px; font-weight:800; color:#2A2420;">${this._formatNumber(soDon)}</div>
          </div>
        </div>

        ${this.session?.role === 'admin' ? (this._zeroValueOrdersFiltered.length > 0 ? `
        <!-- CẢNH BÁO ĐƠN 0Đ (CÓ LỖI) -->
        <div onclick="App._showDonKhongDong()" style="background:linear-gradient(135deg, #FFEBEE, #FFCDD2); padding:16px 20px; border-radius:16px; border:1px solid #EF9A9A; box-shadow:var(--shadow-sm); cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s; margin-bottom:16px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)'" title="Bấm để xem danh sách">
           <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:24px;">⚠️</span>
              <div>
                 <div style="font-size:16px; font-weight:700; color:#B71C1C;">Cảnh báo: Phát hiện ${this._zeroValueOrdersFiltered.length} đơn có giá trị 0đ</div>
                 <div style="font-size:13px; color:#C62828; margin-top:2px;">Bấm vào đây để rà soát danh sách, đề phòng sale giấu doanh thu.</div>
              </div>
           </div>
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B71C1C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        ` : `
        <!-- CẢNH BÁO ĐƠN 0Đ (AN TOÀN) -->
        <div onclick="App._showDonKhongDong()" style="background:linear-gradient(135deg, #E8F5E9, #C8E6C9); padding:16px 20px; border-radius:16px; border:1px solid #A5D6A7; box-shadow:var(--shadow-sm); cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s; margin-bottom:16px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)'" title="An toàn">
           <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:24px; color:#2E7D32;">✓</span>
              <div>
                 <div style="font-size:16px; font-weight:700; color:#2E7D32;">Không phát hiện đơn giá trị 0đ nào</div>
                 <div style="font-size:13px; color:#388E3C; margin-top:2px;">Kỳ này không có dấu hiệu sale giấu doanh thu. (Có thể bấm để xem danh sách trống)</div>
              </div>
           </div>
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        `) : ''}

        <!-- BIỂU ĐỒ -->
        <div id="dt-charts-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap:16px; margin-bottom:16px;">
          <!-- Biểu đồ đường (Trend) -->
          <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px; display:flex; flex-direction:column;">
            <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">Xu hướng Doanh số theo ngày</h3>
            <div style="flex-grow:1; min-height:300px; position:relative; display:flex; justify-content:center; align-items:center;">
              <canvas id="chart-trend"></canvas>
              <div id="chart-trend-empty" style="display:none; color:var(--clr-text-muted); font-size:14px; position:absolute;">Không có dữ liệu để vẽ biểu đồ</div>
            </div>
          </div>
          <!-- Biểu đồ tỷ trọng -->
          <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px; display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="margin:0; font-size:16px; font-weight:600;">Cơ cấu Doanh thu</h3>
              <select id="chart-pie-dimension" class="form-select" style="width:auto; padding:4px 24px 4px 8px; font-size:13px;" onchange="App._drawDoanhThuPieChart(this.value)">
                <option value="nganh">Theo Ngành</option>
                <option value="sale_phu_trach">Theo Sale</option>
                <option value="item">Theo Item</option>
              </select>
            </div>
            <div style="flex-grow:1; min-height:300px; position:relative; display:flex; justify-content:center; align-items:center;">
              <canvas id="chart-pie"></canvas>
              <div id="chart-pie-empty" style="display:none; color:var(--clr-text-muted); font-size:14px; position:absolute;">Không có dữ liệu để vẽ biểu đồ</div>
            </div>
          </div>
        </div>

        <!-- BẢNG THEO NGÀY -->
        <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden;">
          <div style="padding:20px; border-bottom:1px solid var(--clr-border-light); display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:16px; font-weight:600;">Doanh thu theo ngày</h3>
            <button class="btn btn-outline btn-sm" onclick="App._exportDoanhThuCsv()">
              <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right:6px;" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Xuất Excel
            </button>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
              <thead>
                <tr style="background:rgba(0,0,0,0.02); color:var(--clr-text-muted); font-size:12px; text-transform:uppercase; letter-spacing:0.05em; text-align:left;">
                  <th style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light);">Ngày</th>
                  <th style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); text-align:center;">Số giao dịch</th>
                  <th style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); text-align:right;">Tổng thu trong ngày</th>
                </tr>
              </thead>
              <tbody>
                ${dailyArr.length > 0 ? dailyArr.map(r => `
                  <tr class="table-row-hover">
                    <td style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); font-weight:500;">${r.date}</td>
                    <td style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); text-align:center;">${r.count}</td>
                    <td style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); text-align:right; font-weight:600; color:${r.total >= 0 ? 'var(--clr-accent)' : '#E74C3C'}">${this._formatVND(r.total)}</td>
                  </tr>
                `).join('') : `<tr><td colspan="3" style="padding:32px; text-align:center; color:var(--clr-text-muted);">Không có doanh thu trong kỳ này</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    const trendArr = Object.values(trendMap).sort((a, b) => b.parsedDate - a.parsedDate);
    setTimeout(() => this._initDoanhThuCharts(trendArr), 100);
  },

  _initDoanhThuCharts(dailyArr) {
    if (!window.Chart) return;
    this._doanhThuCharts = this._doanhThuCharts || {};

    // 1. Vẽ biểu đồ Đường
    if (this._doanhThuCharts.trend) {
      this._doanhThuCharts.trend.destroy();
    }
    
    const canvasTrend = document.getElementById('chart-trend');
    const emptyTrend = document.getElementById('chart-trend-empty');
    if (canvasTrend && emptyTrend) {
      if (!dailyArr || dailyArr.length === 0) {
        canvasTrend.style.display = 'none';
        emptyTrend.style.display = 'block';
      } else {
        canvasTrend.style.display = 'block';
        emptyTrend.style.display = 'none';

        const chartData = [...dailyArr].reverse();
        const labels = chartData.map(r => r.date.substring(0, 5)); 

        const ctx = canvasTrend.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, canvasTrend.parentElement.offsetHeight || 300);
        gradient.addColorStop(0, 'rgba(183, 168, 143, 0.5)'); // #B7A88F
        gradient.addColorStop(1, 'rgba(183, 168, 143, 0.0)');

        this._doanhThuCharts.trend = new Chart(canvasTrend, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Doanh số (VNĐ)',
              data: chartData.map(r => r.total),
              borderColor: '#B7A88F',
              backgroundColor: gradient,
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#B7A88F',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: function() { return ''; },
                  label: function(context) {
                    let value = context.raw || 0;
                    return 'Doanh số ngày ' + (context.label || '') + ': ' + Number(value).toLocaleString('vi-VN') + ' đ';
                  }
                }
              }
            },
            scales: { y: { beginAtZero: true } }
          }
        });
      }
    }

    // 2. Vẽ biểu đồ Tròn
    const dimSelect = document.getElementById('chart-pie-dimension');
    if (dimSelect) {
      this._drawDoanhThuPieChart(dimSelect.value);
    }
  },

  _drawDoanhThuPieChart(dimension) {
    if (!window.Chart) return;
    this._doanhThuCharts = this._doanhThuCharts || {};
    
    if (this._doanhThuCharts.pie) {
      this._doanhThuCharts.pie.destroy();
    }

    const canvasPie = document.getElementById('chart-pie');
    const emptyPie = document.getElementById('chart-pie-empty');
    if (!canvasPie || !emptyPie) return;

    if (!this._doanhThuCurrentFilteredData || this._doanhThuCurrentFilteredData.length === 0) {
      canvasPie.style.display = 'none';
      emptyPie.style.display = 'block';
      return;
    }

    const mapGroup = {};
    this._doanhThuCurrentFilteredData.forEach(r => {
      let key = r[dimension];
      if (typeof key === 'string') key = key.trim();
      if (!key) key = 'Không xác định';
      if (!mapGroup[key]) mapGroup[key] = 0;
      mapGroup[key] += r.so_tien;
    });

    const keys = [];
    const values = [];
    Object.entries(mapGroup)
      .sort((a, b) => b[1] - a[1]) // Giảm dần
      .forEach(([k, v]) => {
        if (v > 0) {
          keys.push(k);
          values.push(v);
        }
      });

    if (values.length === 0) {
      canvasPie.style.display = 'none';
      emptyPie.style.display = 'block';
      return;
    }

    canvasPie.style.display = 'block';
    emptyPie.style.display = 'none';

    this._doanhThuCharts.pie = new Chart(canvasPie, {
      type: 'bar',
      data: {
        labels: keys,
        datasets: [{
          data: values,
          backgroundColor: '#B7A88F',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const val = context.raw || 0;
                return label + ': ' + App._formatVND(val);
              }
            }
          }
        }
      }
    });
  },

  _exportDoanhThuCsv() {
    if (!this._doanhThuCurrentExport || this._doanhThuCurrentExport.length === 0) {
      this._showToast('Không có dữ liệu để xuất.', 'error');
      return;
    }
    const headers = ['Ngày', 'Số giao dịch', 'Tổng thu trong ngày'];
    const rows = this._doanhThuCurrentExport.map(r => [
      r.date, 
      r.count, 
      r.total
    ]);
    
    // Add BOM for Excel UTF-8
    let csvContent = '\\uFEFF' + headers.join(',') + '\\n';
    rows.forEach(r => {
      csvContent += r.join(',') + '\\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Doanh_Thu_Pixel_${this._formatDateToday().replace(/\\//g,'-')}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ════════════════════════════════════════════════════════════
  //  KANBAN PAGE
  // ════════════════════════════════════════════════════════════

  KANBAN_COLS: [
    'Đơn mới',
    'Đang thiết kế',
    'Pending',
    'Chờ leader duyệt',
    'Gửi khách hàng',
    'Đơn cần chỉnh sửa',
    'Chờ khách hàng phản hồi',
    'Cần xuất hoàn thành',
    'Bàn giao khách hàng',
    'Hoàn thành đơn',
  ],

  LABEL_PRESETS: [
    { nhan: 'Ưu tiên',     mau: '#E67E22' },
    { nhan: 'Gấp',         mau: '#E74C3C' },
    { nhan: 'Đã thanh toán', mau: '#8E44AD' },
    { nhan: 'Chỉnh sửa nhỏ', mau: '#1E8449' },
    { nhan: 'Đúng deadline', mau: '#27AE60' },
    { nhan: 'Lưu trữ',      mau: '#7F8C8D' },
  ],

  async renderKanbanPage() {
    const content = document.getElementById('page-content');
    content.style.padding = '24px';
    content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0;flex-direction:column;gap:16px;">
      <div class="spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(138,114,76,0.2);border-top-color:var(--clr-accent);"></div>
      <p style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Đang tải bảng Kanban...</p>
    </div>`;

    // Load DON_HANG + DIEM_DESIGNER + NHAN_DON + KHACH_HANG concurrently
    let donHangList = [], diemDesignerList = [], nhanDonList = [], khachHangList = [], tienDonList = [];
    await Promise.allSettled([
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, 'A:T')
        .then(r => { donHangList = r || []; })
        .catch(e => console.warn('[Kanban] DON_HANG:', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.DIEM_DESIGNER)
        .then(r => { diemDesignerList = r || []; })
        .catch(e => console.warn('[Kanban] DIEM_DESIGNER:', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.NHAN_DON)
        .then(r => { nhanDonList = r || []; })
        .catch(e => console.warn('[Kanban] NHAN_DON:', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.KHACH_HANG, 'A:I')
        .then(r => { khachHangList = r || []; })
        .catch(e => console.warn('[Kanban] KHACH_HANG:', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.NHAN_SU)
        .then(r => { this._nhanSuList = r || []; })
        .catch(e => console.warn('[Kanban] NHAN_SU:', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.COMMENT)
        .then(r => { this._commentList = r || []; })
        .catch(e => console.warn('[Kanban] COMMENT:', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.GIAO_DICH_TIEN)
        .then(r => { this._giaoDichTienList = r || []; })
        .catch(e => console.warn('[Kanban] GIAO_DICH_TIEN:', e.message)),
      this._readSheet(this.session.accessToken, CONFIG.SHEETS.TIEN_DON, 'A:B')
        .then(r => { tienDonList = r || []; })
        .catch(e => console.warn('[Kanban] TIEN_DON:', e.message)),
    ]);

    const tienDonMap = {};
    tienDonList.forEach(row => { if (row.ma_don) tienDonMap[row.ma_don] = row.tong_gia_tri; });
    donHangList.forEach(d => { if (tienDonMap[d.ma_don] !== undefined) d.tong_gia_tri = tienDonMap[d.ma_don]; });

    // Cache the mapping globally in case other methods need it (like _openCardDetail which relies on donHangList)
    this._donHangList = donHangList;


    // Build designer lookup: ma_don → [ten_designer, ...]
    const designerMap = {};
    const designerScoreMap = {};
    diemDesignerList.forEach(d => {
      const ma = d.ma_don || '';
      if (!ma) return;
      if (!designerMap[ma]) designerMap[ma] = [];
      if (!designerScoreMap[ma]) designerScoreMap[ma] = {};
      let ten = d.ten_designer || d.designer || d.ho_ten || d.ten || '';
      
      if (ten.includes('@') && this._nhanSuList) {
         const ns = this._nhanSuList.find(n => n.email === ten);
         if (ns) {
            ten = ns.ten || ns.ho_ten || ns.ten_nhan_vien || ten;
         }
      }
      
      if (ten && !designerMap[ma].includes(ten)) {
        designerMap[ma].push(ten);
        designerScoreMap[ma][ten] = d.diem || '';
      }
    });
    this._kanbanDesignerScoreMap = designerScoreMap;

    // Build label lookup: ma_don → [{nhan, mau}, ...]
    const labelMap = {};
    nhanDonList.forEach(r => {
      const ma = r.ma_don || '';
      if (!ma) return;
      if (!labelMap[ma]) labelMap[ma] = [];
      labelMap[ma].push({ nhan: r.nhan || '', mau: r.mau || '#999' });
    });

    // Build khach hang lookup: ma_kh → { fanpage, zalo, sdt, brand, nganh }
    const khachHangMap = {};
    khachHangList.forEach(k => {
      const ma = k.ma_kh;
      if (ma) khachHangMap[ma] = k;
    });

    this._kanbanData        = donHangList;
    this._kanbanDesignerMap = designerMap;
    this._kanbanLabelMap    = labelMap;
    this._kanbanKhachHangMap= khachHangMap;
    this._kanbanNhanDonRaw  = nhanDonList;

    // Cache row index
    this._kanbanRowMap = {};
    donHangList.forEach((d, idx) => { this._kanbanRowMap[d.ma_don] = idx + 2; });

    this._renderKanbanBoard();
  },

  _renderKanbanBoard(filterQ = '') {
    // Save scroll state before replacing innerHTML
    const board = document.getElementById('kb-board');
    const scrollState = {
      windowY: window.scrollY,
      boardX: board ? board.scrollLeft : 0,
      boardY: board ? board.scrollTop : 0,
      colsY: Array.from(document.querySelectorAll('.kb-col-body')).map(c => c.scrollTop)
    };

    const content = document.getElementById('page-content');
    const q = filterQ.toLowerCase();
    const donList = this._kanbanData || [];

    let filtered = q
      ? donList.filter(d =>
          (d.ma_don || '').toLowerCase().includes(q) ||
          (d.ten_khach || '').toLowerCase().includes(q) ||
          (d.brand || '').toLowerCase().includes(q))
      : [...donList];

    // Sort by thu_tu
    filtered.sort((a, b) => {
       const orderA = (a.thu_tu !== undefined && a.thu_tu !== '') ? parseFloat(a.thu_tu) : 0;
       const orderB = (b.thu_tu !== undefined && b.thu_tu !== '') ? parseFloat(b.thu_tu) : 0;
       return orderA - orderB;
    });

    // Group by cot_kanban
    const colMap = {};
    this.KANBAN_COLS.forEach(c => { colMap[c] = []; });
    filtered.forEach(d => {
      const col = d.cot_kanban || 'Đơn mới';
      if (!colMap[col]) colMap[col] = [];
      colMap[col].push(d);
    });

    const totalActive = filtered.filter(d => !d.trang_thai || d.trang_thai === 'đang chạy').length;

    content.innerHTML = `
      <div class="kb-wrapper">
        <div class="kb-topbar">
          <div class="kb-search-wrapper">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="kb-search" id="kb-search-input" placeholder="Tìm theo mã đơn, tên khách, brand..." value="${this._escHtml(filterQ)}" oninput="App._onKanbanSearch(this.value)" autocomplete="off"/>
          </div>
          <div class="kb-stats">
            <span class="kb-stat-badge">${totalActive} đơn đang chạy</span>
            <button class="btn btn-ghost btn-sm" onclick="App.renderKanbanPage()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Tải lại
            </button>
          </div>
        </div>

        <div class="kb-board" id="kb-board">
          ${this.KANBAN_COLS.map(col => this._renderKanbanCol(col, colMap[col] || [])).join('')}
        </div>
      </div>
    `;

    this._setupKanbanDnD();

    // Restore scroll state
    if (scrollState.windowY) window.scrollTo(0, scrollState.windowY);
    const newBoard = document.getElementById('kb-board');
    if (newBoard) {
       newBoard.scrollLeft = scrollState.boardX;
       newBoard.scrollTop = scrollState.boardY;
    }
    const newCols = document.querySelectorAll('.kb-col-body');
    newCols.forEach((c, i) => {
       if (scrollState.colsY[i]) c.scrollTop = scrollState.colsY[i];
    });
  },

  _renderKanbanCol(colName, cards) {
    const activeCount = cards.filter(d => !d.trang_thai || d.trang_thai === 'đang chạy').length;
    return `
      <div class="kb-col" data-col="${this._escHtml(colName)}"
           ondragover="App._onDragOver(event)" ondrop="App._onDrop(event, '${this._escHtml(colName)}')" ondragleave="App._onDragLeave(event)">
        <div class="kb-col-header">
          <span class="kb-col-title">${this._escHtml(colName)}</span>
          <span class="kb-col-count">${activeCount}</span>
        </div>
        <div class="kb-col-body" id="kb-col-${this._slugify(colName)}">
          ${cards.length === 0
            ? `<div class="kb-empty-drop">Kéo thẻ vào đây</div>`
            : cards.map(d => this._renderKanbanCard(d)).join('')}
        </div>
      </div>`;
  },

  _renderKanbanCard(d) {
    const isHuy        = d.trang_thai && d.trang_thai.toLowerCase().startsWith('hủy');
    const isDesigner   = this.session?.role === 'designer';
    const isSaleAdmin  = ['admin', 'sale'].includes(this.session?.role);
    const designers    = (this._kanbanDesignerMap[d.ma_don] || []).join(', ');
    const labels       = this._kanbanLabelMap?.[d.ma_don] || [];
    const deadline     = this._deadlineClass(d.ngay_het_han);
    const draggable    = isHuy ? 'false' : 'true';
    const cardStyle    = isHuy ? 'opacity:0.6; filter:grayscale(80%);' : '';

    const giaoDichList = (this._giaoDichTienList || []).filter(g => g.ma_don === d.ma_don);
    let daThucThu = 0;
    giaoDichList.forEach(g => {
       const tien = App._parseCurrency(g.so_tien);
       if (!isNaN(tien)) daThucThu += tien;
    });
    const tongGiaTri = App._parseCurrency(d.tong_gia_tri);
    const isThuDu = tongGiaTri > 0 && daThucThu >= tongGiaTri;

    let dynamicStatus = 'Đang chạy';
    let statusBg = '#a89f91';
    if (isHuy) {
      dynamicStatus = 'Đã hủy';
      statusBg = 'var(--clr-error)';
    } else if (d.cot_kanban === 'Hoàn thành đơn' && isThuDu) {
      dynamicStatus = 'Hoàn thành';
      statusBg = '#27ae60';
    }

    // Label strips at top of card
    const labelsHtml = labels.length > 0
      ? `<div class="kb-card-labels">${labels.map(l =>
          `<span class="kb-label-pill" style="background:${this._escHtml(l.mau)}; color: #fff;" title="${this._escHtml(l.nhan)}">${this._escHtml(l.nhan)}</span>`
        ).join('')}</div>` : '';

    const cancelLabel = `
      <div style="display:flex; gap:4px; align-items:center; margin-top:2px; flex-wrap:wrap;">
        <span style="background:${statusBg}; color:#fff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;">${dynamicStatus}</span>
        ${(isSaleAdmin && isThuDu) ? `<span style="background:#3498db; color:#fff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;" title="Đã thu đủ tiền">Đã thu đủ</span>` : ''}
      </div>
    `;

    const deadlineHtml = d.ngay_het_han
      ? `<div class="kb-card-deadline ${deadline}">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
           ${this._escHtml(d.ngay_het_han)}
         </div>` : '';

    const designerHtml = designers
      ? `<div class="kb-card-designer">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
           ${this._escHtml(designers)}
         </div>` : '';

    const maKhText = (!isDesigner && d.ma_kh) ? ` <span style="color: #DCC9A7; font-weight: normal;">· ${this._escHtml(d.ma_kh)}</span>` : '';

    const designersList = this._kanbanDesignerMap?.[d.ma_don] || [];
    const avatarsHtml = designersList.length > 0 ? `<div style="display:flex; gap:4px; margin-left:auto; align-items:center;">` + designersList.map(name => {
      const parts = name.trim().split(/\s+/);
      let initials = '?';
      if (parts.length >= 2) {
         initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0]) {
         initials = parts[0][0].toUpperCase();
      }
      let hash = 0;
      for(let i=0; i<name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
      const colors = ['#9C7E5E', '#C4B5D9', '#A8D5C4', '#F2C4B3', '#B5CDA3', '#A9C9DE', '#EBC4CE', '#F0D9A7'];
      const bg = colors[Math.abs(hash) % colors.length];
      return `<div title="${this._escHtml(name)}" style="width:24px;height:24px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;cursor:pointer;">${initials}</div>`;
    }).join('') + `</div>` : '';

    return `
      <div class="kb-card ${isHuy ? 'kb-card-cancelled' : ''}"
           data-don="${this._escHtml(d.ma_don)}"
           draggable="${draggable}"
           ondragstart="App._onDragStart(event, '${this._escHtml(d.ma_don)}')"
           ondragend="App._onDragEnd(event)"
           onclick="App._openCardDetail('${this._escHtml(d.ma_don)}')"
           style="${cardStyle}">
        ${labelsHtml}
        <div class="kb-card-top">
          <span class="kb-card-id">${this._escHtml(d.ma_don)}${maKhText}</span>
          ${cancelLabel}
          ${d.item ? `<span class="kb-tag kb-tag-item">${this._escHtml(d.item)}</span>` : ''}
        </div>
        <div class="kb-card-name">${this._escHtml(d.ten_khach || '')}</div>
        <div class="kb-card-footer" style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
          ${deadlineHtml}
          ${avatarsHtml}
        </div>
      </div>`;
  },

  _formatDatetimeLocal(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    let dStr = '', tStr = '';
    const dateTrim = dateStr.trim();
    if (!dateTrim) return '';
    
    if (dateTrim.includes('T')) {
       const isoParts = dateTrim.split('T');
       dStr = isoParts[0];
       tStr = isoParts[1] || '00:00';
    } else {
       const parts = dateTrim.split(/\s+/);
       dStr = parts[0];
       tStr = parts[1] || '00:00';
    }
    
    let y, m, d;
    if (dStr.includes('/')) {
       [d, m, y] = dStr.split('/');
    } else if (dStr.includes('-')) {
       [y, m, d] = dStr.split('-');
    } else {
       return '';
    }
    
    if (!y || !m || !d) return '';
    if (y.length === 2) y = '20' + y;
    
    y = y.padStart(4, '0');
    m = m.padStart(2, '0');
    d = d.padStart(2, '0');
    
    let [hh, mm] = tStr.split(':');
    if (!hh) hh = '00';
    if (!mm) mm = '00';
    hh = hh.padStart(2, '0');
    mm = mm.padStart(2, '0');
    
    const hour = parseInt(hh, 10);
    const minute = parseInt(mm, 10);
    if (isNaN(hour) || hour > 23 || hour < 0) hh = '00';
    if (isNaN(minute) || minute > 59 || minute < 0) mm = '00';
    
    return `${y}-${m}-${d}T${hh}:${mm}`;
  },

  _deadlineClass(dateStr) {
    const iso = this._formatDatetimeLocal(dateStr);
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    if (diff < 0)  return 'kb-deadline-overdue';
    if (diff <= 2) return 'kb-deadline-urgent';
    if (diff <= 7) return 'kb-deadline-soon';
    return '';
  },

  _slugify(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd').replace(/\s+/g,'_').replace(/[^a-z0-9_]/gi,'').toLowerCase();
  },

  _onKanbanSearch(q) {
    clearTimeout(this._kanbanSearchTimer);
    this._kanbanSearchTimer = setTimeout(() => this._renderKanbanBoard(q), 200);
  },

  // ── Drag & Drop ──────────────────────────────────────────────
  _stopDragScroll() {
    if (this._dragScrollInterval) {
      clearInterval(this._dragScrollInterval);
      this._dragScrollInterval = null;
    }
  },

  _setupKanbanDnD() { 
    this._draggingDon = null; 
    this._stopDragScroll();
    this._currentDragSpeed = 0;

    const board = document.getElementById('kb-board');
    if (!board) return;

    this._onDragOverBoard = (ev) => {
      const rect = board.getBoundingClientRect();
      const x = ev.clientX;
      const EDGE = 150; // pixels from edge to trigger scroll
      let speed = 0;

      if (x > rect.right - EDGE) {
        speed = ((x - (rect.right - EDGE)) / EDGE) * 25;
      } else if (x < rect.left + EDGE) {
        speed = -((((rect.left + EDGE) - x) / EDGE) * 25);
      }

      if (speed !== 0) {
        this._currentDragSpeed = speed;
        if (!this._dragScrollInterval) {
          this._dragScrollInterval = setInterval(() => {
            if (board) board.scrollLeft += this._currentDragSpeed;
          }, 16);
        }
      } else {
        this._stopDragScroll();
      }
    };

    board.addEventListener('dragover', this._onDragOverBoard);
    board.addEventListener('drop', () => this._stopDragScroll());
    board.addEventListener('dragleave', (ev) => {
       const rect = board.getBoundingClientRect();
       if (ev.clientX <= rect.left || ev.clientX >= rect.right || ev.clientY <= rect.top || ev.clientY >= rect.bottom) {
          this._stopDragScroll();
       }
    });
  },

  _onDragStart(ev, maDon) {
    this._draggingDon = maDon;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', maDon);
    setTimeout(() => ev.target.classList.add('kb-card-dragging'), 0);
  },

  _onDragEnd(ev) { 
    ev.target.classList.remove('kb-card-dragging'); 
    this._stopDragScroll();
  },
  _onDragLeave(ev) { ev.currentTarget.classList.remove('kb-col-over'); },

  _onDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    ev.currentTarget.classList.add('kb-col-over');
  },

  _getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.kb-card:not(.kb-card-dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  },

  async _onDrop(ev, newCol) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('kb-col-over');
    const maDon = this._draggingDon || ev.dataTransfer.getData('text/plain');
    if (!maDon) return;

    const don = (this._kanbanData || []).find(d => d.ma_don === maDon);
    if (!don) return;
    if (don.trang_thai && don.trang_thai.toLowerCase().startsWith('hủy')) return;

    const container = ev.currentTarget.querySelector('.kb-col-body');
    const afterElement = this._getDragAfterElement(container, ev.clientY);

    const oldCol = don.cot_kanban;
    const oldThuTu = don.thu_tu;

    let newThuTu = 0;
    let colCards = (this._kanbanData || []).filter(d => d.cot_kanban === newCol && d.ma_don !== maDon);
    colCards.sort((a, b) => {
       const orderA = (a.thu_tu !== undefined && a.thu_tu !== '') ? parseFloat(a.thu_tu) : 0;
       const orderB = (b.thu_tu !== undefined && b.thu_tu !== '') ? parseFloat(b.thu_tu) : 0;
       return orderA - orderB;
    });

    if (afterElement) {
       const afterMaDon = afterElement.getAttribute('data-don');
       const afterIndex = colCards.findIndex(d => d.ma_don === afterMaDon);
       if (afterIndex === 0) {
          newThuTu = (parseFloat(colCards[0].thu_tu) || 0) - 1000;
       } else if (afterIndex > 0) {
          const prevThuTu = parseFloat(colCards[afterIndex - 1].thu_tu) || 0;
          const nextThuTu = parseFloat(colCards[afterIndex].thu_tu) || 0;
          newThuTu = (prevThuTu + nextThuTu) / 2;
       }
    } else {
       if (colCards.length === 0) {
          newThuTu = 1000;
       } else {
          newThuTu = (parseFloat(colCards[colCards.length - 1].thu_tu) || 0) + 1000;
       }
    }

    if (don.cot_kanban === newCol && don.thu_tu == newThuTu) return;

    don.cot_kanban = newCol;
    don.thu_tu = newThuTu;

    this._renderKanbanBoard(document.getElementById('kb-search-input')?.value || '');

    try {
      await this._kanbanUpdateCotKanbanVaThuTu(maDon, newCol, newThuTu);
      this._showToast(`✅ Cập nhật vị trí ${maDon}`, 'success', 2500);
    } catch (e) {
      don.cot_kanban = oldCol;
      don.thu_tu = oldThuTu;
      this._renderKanbanBoard(document.getElementById('kb-search-input')?.value || '');
      this._showToast(`Lỗi cập nhật: ${e.message}`, 'error');
    }
  },

  async _kanbanUpdateCotKanbanVaThuTu(maDon, newCol, newThuTu) {
    const rows = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG);
    const idx  = rows.findIndex(r => r.ma_don === maDon);
    if (idx === -1) throw new Error('Không tìm thấy đơn ' + maDon);

    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEETS.DON_HANG + '!1:1')}`,
      { headers: { Authorization: `Bearer ${this.session.accessToken}` } }
    );
    const headerData = await headerRes.json();
    const headers = (headerData.values || [[]])[0] || [];
    
    const colIdx = headers.indexOf('cot_kanban');
    const thuTuIdx = headers.indexOf('thu_tu');
    
    if (colIdx === -1) throw new Error('Thiếu cột cot_kanban trong Sheets');
    if (thuTuIdx === -1) throw new Error('Thiếu cột thu_tu trong Sheets');

    const colLetter = this._colIndexToLetter(colIdx);
    const thuTuLetter = this._colIndexToLetter(thuTuIdx);
    const sheetRow  = idx + 2;

    await Promise.all([
      this._writeSheet(CONFIG.SHEETS.DON_HANG, `${colLetter}${sheetRow}`, [[newCol]]),
      this._writeSheet(CONFIG.SHEETS.DON_HANG, `${thuTuLetter}${sheetRow}`, [[newThuTu]])
    ]);
  },

  _colIndexToLetter(idx) {
    let result = '';
    idx = idx + 1;
    while (idx > 0) {
      const rem = (idx - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      idx = Math.floor((idx - 1) / 26);
    }
    return result;
  },

  // ── Card Detail Popup ─────────────────────────────────────────
  _openCardDetail(maDon) {
    const existing = document.getElementById('kb-detail-overlay');
    if (existing) {
      existing.remove();
    }

    const don = this._kanbanData.find(d => d.ma_don === maDon);
    if (!don) return;

    const isDesigner  = this.session?.role === 'designer';
    const isSaleAdmin = !isDesigner; // sale hoặc admin
    const isCancelled = don.trang_thai && don.trang_thai !== 'đang chạy';

    // ── File links ────────────────────────────────────────────
    const linkLines = (don.link_anh || '').split('\n').filter(Boolean);
    const linksHtml = linkLines.length > 0
      ? linkLines.map((url, i) => {
          const name  = url.match(/\/([^/]+)\/(view|preview|download)?$/)?.[1] || `File ${i+1}`;
          const isImg = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url);
          return isImg
            ? `<a href="${this._escHtml(url)}" target="_blank" class="kb-detail-file kb-detail-img-link">
                 <img src="${this._escHtml(url.replace('view','preview'))}" alt="${i+1}" onerror="this.style.display='none'"/>
                 <span>${this._escHtml(name)}</span>
               </a>`
            : `<a href="${this._escHtml(url)}" target="_blank" class="kb-detail-file">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                 ${this._escHtml(decodeURIComponent(name))}
               </a>`;
        }).join('')
      : `<p style="color:var(--clr-text-muted);font-size:var(--font-size-sm);">Chưa có file đính kèm.</p>`;

    // ── Dropdowns ────────────────────────────────────────────
    const colOpts = this.KANBAN_COLS.map(c =>
      `<option value="${this._escHtml(c)}"${don.cot_kanban === c ? ' selected' : ''}>${this._escHtml(c)}</option>`
    ).join('');
    const trangThaiOpts = ['đang chạy','hủy-hoàn cọc','hủy-giữ cọc'].map(s =>
      `<option value="${s}"${don.trang_thai === s ? ' selected' : ''}>${s}</option>`
    ).join('');

    // ── Label checkboxes (Trello style) ──────────────────────
    const currentLabels = (this._kanbanLabelMap?.[maDon] || []).map(l => l.nhan);
    const labelsCheckboxHtml = this.LABEL_PRESETS.map(l => {
      const checked = currentLabels.includes(l.nhan) ? ' checked' : '';
      return `<label class="kb-label-trello" style="background:${l.mau}; display:flex; align-items:center; justify-content:space-between; padding:6px 12px; border-radius:4px; margin-bottom:6px; cursor:pointer; color:#fff; font-weight:600; font-size:13px; user-select:none;">
        <input type="checkbox" value="${this._escHtml(l.nhan)}" data-mau="${this._escHtml(l.mau)}"${checked} class="kb-label-cb" style="display:none;" onchange="this.nextElementSibling.nextElementSibling.style.display=this.checked?'block':'none'"/>
        <span>${this._escHtml(l.nhan)}</span>
        <span class="label-check" style="display:${checked ? 'block' : 'none'};">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
      </label>`;
    }).join('');

    this._detSelectedFiles = [];

    // ── Deadline Datetime ───────────────────────────────────
    const dtIso = this._formatDatetimeLocal(don.ngay_het_han);
    const ngayHetHanHtml = `
      <div class="kb-detail-field-group">
        <label class="kb-detail-label">Ngày hết hạn</label>
        <input type="datetime-local" class="form-input" id="det-ngay-het-han" value="${dtIso}" style="font-size:var(--font-size-sm);"/>
      </div>
    `;

    // ── Designers Multi-select ──────────────────────────────
    const isLeaderAdmin = ['admin', 'leader'].includes(this.session?.role);

    const assignedDesigners = this._kanbanDesignerMap[maDon] || [];
    const designerScores = this._kanbanDesignerScoreMap?.[maDon] || {};
    const designerStaff = (this._nhanSuList || []).filter(n => n.vai_tro === 'designer').map(n => n.ten || n.ho_ten || n.ten_nhan_vien || n.email || '');
    const availableDesigners = designerStaff.filter(d => d && !assignedDesigners.includes(d));

    let designerHtml = '';
    
    if (isSaleAdmin) {
      let totalScore = 0;
      const tagsHtml = assignedDesigners.map(d => {
         const diem = designerScores[d] || '';
         const val = parseFloat(diem.toString().replace(/,/g, '.'));
         if (!isNaN(val)) totalScore += val;
         
         const removeBtn = isLeaderAdmin ? `<svg onclick="this.parentElement.remove(); App._updateDesignerSelect(); App._calculateTotalScore();" style="cursor:pointer;color:#E74C3C;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` : '';
         const scoreInput = `<input type="text" class="det-designer-score" name="designer_score_${this._escHtml(d)}" value="${this._escHtml(diem)}" placeholder="0" style="width:36px; height:20px; font-size:11px; text-align:center; border:1px solid var(--clr-border); border-radius:2px;" oninput="App._calculateTotalScore()" />`;

         return `
            <span class="kb-tag" style="display:inline-flex;align-items:center;gap:4px;background:var(--clr-bg);border:1px solid var(--clr-border);">
              ${this._escHtml(d)}
              ${scoreInput}
              <input type="hidden" name="assigned_designer" value="${this._escHtml(d)}" />
              ${removeBtn}
            </span>
         `;
      }).join('');

      designerHtml = `
        <div class="kb-info-row" style="flex-direction:column; align-items:flex-start; gap:8px;">
          <span>Designers phụ trách</span>
          <div id="det-designer-tags" style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
            ${tagsHtml}
          </div>
          ${isLeaderAdmin ? `
          <select class="form-select" id="det-designer-select" style="font-size:12px; padding:4px; width:100%;" onchange="App._onDesignerSelect(this)">
            <option value="">+ Thêm designer...</option>
            ${availableDesigners.map(d => `<option value="${this._escHtml(d)}">${this._escHtml(d)}</option>`).join('')}
          </select>` : ''}
          <div style="font-size:12px; font-weight:600; align-self:flex-end; color:var(--clr-text); margin-top:4px;">
            Tổng điểm: <span id="det-total-score">${Number(totalScore.toFixed(2))}</span>
          </div>
        </div>
      `;
    } else {
      let currentUser = this.session?.email || '';
      if (this._nhanSuList) {
        const ns = this._nhanSuList.find(n => n.email === currentUser);
        if (ns) currentUser = ns.ho_ten || ns.ten_nhan_vien || ns.ten || ns.ten_designer || ns.designer || currentUser;
      }

      let diemHtml = '';
      if (assignedDesigners.includes(currentUser)) {
         const diem = designerScores[currentUser] || '';
         const displayScore = diem ? `${diem} P` : 'Chưa chấm điểm';
         diemHtml = `<div style="margin-top:4px; font-size:12px; color:var(--clr-accent);">${this._escHtml(currentUser)}: <strong>${this._escHtml(displayScore)}</strong></div>`;
      }

      designerHtml = `
        <div class="kb-info-row" style="flex-direction:column; align-items:flex-start; gap:4px;">
          <div style="display:flex; justify-content:space-between; width:100%;">
            <span>Designer</span>
            <strong>${this._escHtml(assignedDesigners.join(', ') || '—')}</strong>
          </div>
          ${diemHtml}
        </div>
      `;
    }

    // ── Brief with clickable links ──────────────────────────
    const briefDisplay = this._linkifyText(don.brief || '');

    // ── Contact info (sale/admin only) ──────────────────────
    const kh = this._kanbanKhachHangMap?.[don.ma_kh] || don;
    const contactHtml = isSaleAdmin ? `
      <div class="kb-detail-section">
        <div class="kb-detail-section-title">Liên hệ</div>
        <div class="kb-detail-info-rows">
          ${(kh.fanpage || kh.facebook) ? `<div class="kb-info-row"><span>Fanpage</span><a href="${(kh.fanpage || kh.facebook).startsWith('http')?this._escHtml(kh.fanpage || kh.facebook):'https://'+this._escHtml(kh.fanpage || kh.facebook)}" target="_blank" style="color:var(--clr-accent);font-weight:600;max-width:60%;word-break:break-all;text-align:right;">${this._escHtml(kh.fanpage || kh.facebook)}</a></div>` : ''}
          ${kh.zalo  ? `<div class="kb-info-row"><span>Zalo</span><strong>${this._escHtml(kh.zalo)}</strong></div>` : ''}
          ${kh.sdt   ? `<div class="kb-info-row"><span>SĐT</span><strong>${this._escHtml(kh.sdt)}</strong></div>` : ''}
          ${!kh.fanpage && !kh.facebook && !kh.zalo && !kh.sdt ? '<div style="font-size:11px;color:var(--clr-text-muted);">Chưa có thông tin liên hệ.</div>' : ''}
        </div>
      </div>` : '';

    // ── Finance section (sale/admin only) ──────────────────
    const giaoDichList = (this._giaoDichTienList || []).filter(g => g.ma_don === maDon);
    let daThucThu = 0;
    let tongTip = 0;
    giaoDichList.forEach(g => {
       const tien = App._parseCurrency(g.so_tien);
       if (!isNaN(tien)) {
          daThucThu += tien;
          if ((g.loai || '').toLowerCase() === 'tip') tongTip += tien;
       }
    });
    
    const tongGiaTri = App._parseCurrency(don.tong_gia_tri);
    let conNo = tongGiaTri - daThucThu;
    let conNoHtml = '';
    
    if (conNo < 0) {
       conNoHtml = `<div class="kb-detail-field-group">
            <label class="kb-detail-label">Còn nợ</label>
            <div style="font-size:var(--font-size-sm); color:var(--clr-text); font-weight:600; padding:8px 12px; background:var(--clr-bg); border:1px solid var(--clr-border); border-radius:4px;">
               0 ₫
               <div style="font-size:10px; color:var(--clr-text-muted); margin-top:2px; font-weight:normal;">Đã tip: ${tongTip.toLocaleString('vi-VN')} ₫</div>
            </div>
          </div>`;
       conNo = 0;
    } else {
       conNoHtml = this._detailField('Còn nợ', conNo.toLocaleString('vi-VN') + ' ₫', null, true);
    }
    
    const isCancelledStatus = don.trang_thai && don.trang_thai.toLowerCase().startsWith('hủy');
    const thuTienDisabled = isCancelledStatus ? 'disabled style="opacity:0.5; cursor:not-allowed;" title="Đơn đã hủy, không thể thu thêm"' : '';

    const financeHtml = isSaleAdmin ? `
      <div class="kb-detail-section">
        <div class="kb-detail-section-title">Tài chính</div>
        <div class="kb-detail-grid">
          ${this._detailField('Tổng giá trị', tongGiaTri.toLocaleString('vi-VN') + ' ₫', null, true)}
          ${this._detailField('Đã thực thu', daThucThu.toLocaleString('vi-VN') + ' ₫', null, true)}
          ${conNoHtml}
        </div>
        
        ${giaoDichList.length > 0 ? `
        <div style="margin-top:12px; font-size:12px; border:1px solid var(--clr-border); border-radius:4px; overflow:hidden;">
           <div style="background:rgba(0,0,0,0.03); padding:6px 8px; font-weight:600; border-bottom:1px solid var(--clr-border);">Lịch sử giao dịch</div>
           <div style="padding:4px 8px;">
           ${giaoDichList.map(g => `
              <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--clr-border);">
                <span>${this._escHtml(g.ngay || '')} <span style="color:var(--clr-text-muted);">(${this._escHtml(g.loai || '')})</span></span>
                <strong>${Number((g.so_tien || '').toString().replace(/[^0-9.-]/g, '') || 0).toLocaleString('vi-VN')} ₫</strong>
              </div>
           `).join('')}
           </div>
        </div>
        ` : ''}
        
        <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
          <button class="btn btn-sm" onclick="App._openThuTienForm(${conNo})" ${thuTienDisabled}>Thu thêm tiền</button>
          <div id="det-thu-tien-form" style="display:none; flex-direction:column; gap:8px; width:100%; align-items:flex-end; background:var(--clr-bg); padding:12px; border:1px solid var(--clr-border); border-radius:4px;">
             <div style="display:flex; gap:8px; width:100%;">
                <select id="det-thu-loai" class="form-select" style="font-size:13px; padding:6px; flex:1;" onchange="if(this.value === 'thu nốt' && document.getElementById('det-thu-tien-input').dataset.conno > 0) document.getElementById('det-thu-tien-input').value = Number(document.getElementById('det-thu-tien-input').dataset.conno).toLocaleString('vi-VN')">
                   <option value="cọc">Cọc</option>
                   <option value="thu nốt" selected>Thu nốt</option>
                   <option value="thu thêm">Thu thêm</option>
                </select>
                <input type="text" id="det-thu-tien-input" class="form-input" placeholder="Số tiền (VNĐ)..." style="font-size:13px; padding:6px; flex:2;" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')" />
             </div>
             <div style="display:flex; gap:8px; margin-top:4px;">
                <button class="btn btn-ghost btn-sm" onclick="document.getElementById('det-thu-tien-form').style.display='none'; document.getElementById('det-thu-tien-form').previousElementSibling.style.display='block';">Hủy</button>
                <button class="btn btn-primary btn-sm" onclick="App._submitThuTien('${this._escHtml(maDon)}')">Xác nhận thu</button>
             </div>
          </div>
        </div>
      </div>` : '';
    const huyDonBtn = (isSaleAdmin && !isCancelledStatus) ? `
      <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px; align-items:flex-end; border-top:1px dashed rgba(231,76,60,0.5); padding-top:12px;">
        <button class="btn btn-sm" style="background:rgba(231,76,60,0.1); color:var(--clr-error); border-color:var(--clr-error);" onclick="document.getElementById('det-huy-don-form').style.display='flex'; this.style.display='none';">Hủy đơn</button>
        <div id="det-huy-don-form" style="display:none; flex-direction:column; gap:8px; width:100%; background:var(--clr-bg); padding:12px; border:1px solid var(--clr-error); border-radius:4px;">
           <div style="font-weight:bold; color:var(--clr-error); font-size:13px; margin-bottom:4px;">XÁC NHẬN HỦY ĐƠN</div>
           
           <label style="font-size:12px; display:flex; align-items:center; gap:6px;">
             <input type="radio" name="huy_loai" id="det-huy-loai-A" value="A" checked onchange="document.getElementById('det-huy-hoan-tien-wrapper').style.display='none'; document.getElementById('det-huy-hoan-tien').value='';" />
             Hủy - Hoàn cọc 100% (Doanh thu về 0)
           </label>
           
           <label style="font-size:12px; display:flex; align-items:flex-start; gap:6px; margin-top:4px;">
             <input type="radio" name="huy_loai" id="det-huy-loai-B" value="B" onchange="document.getElementById('det-huy-hoan-tien-wrapper').style.display='flex';" />
             <div style="display:flex; flex-direction:column; width:100%;">
                <span>Hủy - Giữ cọc (hoặc hoàn một phần)</span>
                <div id="det-huy-hoan-tien-wrapper" style="display:none; align-items:center; gap:6px; margin-top:4px; width:100%;">
                   <span style="font-size:11px; color:var(--clr-text-muted);">Số tiền hoàn lại:</span>
                   <input type="text" id="det-huy-hoan-tien" class="form-input" style="font-size:12px; padding:4px; flex:1;" placeholder="0" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')" />
                   <span style="font-size:11px; color:var(--clr-text-muted); cursor:pointer; font-weight:600; padding:2px 4px; background:rgba(0,0,0,0.05); border-radius:2px;" onclick="document.getElementById('det-huy-hoan-tien').value='${daThucThu.toLocaleString('vi-VN')}';">Tối đa</span>
                </div>
             </div>
           </label>
           
           <input type="text" id="det-huy-ly-do" class="form-input" placeholder="Lý do hủy (không bắt buộc)..." style="font-size:12px; padding:6px; margin-top:8px;" />
           
           <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('det-huy-don-form').style.display='none'; document.getElementById('det-huy-don-form').previousElementSibling.style.display='block';">Quay lại</button>
              <button class="btn btn-sm" style="background:#c0392b !important; color:#ffffff !important; border:none; font-weight:bold; padding:4px 12px; opacity:1;" onclick="App._submitHuyDon('${this._escHtml(maDon)}', ${daThucThu})">Xác nhận hủy</button>
           </div>
        </div>
      </div>
    ` : '';

    // ── Status section (sale/admin only) ────────────────────
    const statusHtml = isSaleAdmin ? `
      <div class="kb-detail-section">
        <div class="kb-detail-section-title">Tiến độ &amp; Trạng thái</div>
        <div class="kb-detail-grid">
          <div class="kb-detail-field-group">
            <label class="kb-detail-label">Cột Kanban</label>
            <select class="form-select" id="det-cot-kanban" style="font-size:var(--font-size-sm);">${colOpts}</select>
          </div>
          <div class="kb-detail-field-group">
            <label class="kb-detail-label">Trạng thái</label>
            <div style="font-size:var(--font-size-sm); padding:6px 12px; background:var(--clr-bg); border:1px solid var(--clr-border); border-radius:4px; font-weight:600; color:var(--clr-text);">
              ${(don.trang_thai && don.trang_thai.toLowerCase().startsWith('hủy')) ? 'Đã hủy' : (don.cot_kanban === 'Hoàn thành đơn' && tongGiaTri > 0 && daThucThu >= tongGiaTri ? 'Hoàn thành' : 'Đang chạy')}
            </div>
          </div>
        </div>
        ${huyDonBtn}
      </div>` : `
      <div class="kb-detail-section">
        <div class="kb-detail-section-title">Tiến độ</div>
        <div class="kb-detail-info-rows">
          <div class="kb-info-row"><span>Cột</span><strong>${this._escHtml(don.cot_kanban||'—')}</strong></div>
        </div>
      </div>`;

    const maKhClean = (don.ma_kh || '').replace(/-/g, '');
    const tenGroupZalo = `${maKhClean} - ${don.ten_khach || ''} - ${don.item || ''}`;
    const zaloGroupHtml = isSaleAdmin ? `
      <div class="kb-info-row">
        <span>Tên group Zalo</span>
        <div style="display:flex;align-items:center;gap:8px;text-align:right;">
          <strong style="word-break:break-all;">${this._escHtml(tenGroupZalo)}</strong>
          <button type="button" class="btn btn-outline" style="padding:2px 6px;font-size:10px;height:auto;min-height:0;flex-shrink:0;" onclick="navigator.clipboard.writeText('${this._escHtml(tenGroupZalo)}'); const t=this; t.innerText='Đã copy'; setTimeout(()=>t.innerText='Copy', 2000);">Copy</button>
        </div>
      </div>
    ` : '';

    const overlay = document.createElement('div');
    overlay.id = 'kb-detail-overlay';
    overlay.className = 'kb-overlay';

    // ── Comments ────────────────────────────────────────────
    const donComments = (this._commentList || []).filter(c => c.ma_don === maDon);
    let commentsHtml = donComments.map(c => `
      <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--clr-border);">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <strong style="font-size:12px; color:var(--clr-text);">${this._escHtml(c.nguoi || 'Ẩn danh')}</strong>
          <span style="font-size:10px; color:var(--clr-text-muted);">${this._escHtml(c.thoi_gian || '')}</span>
        </div>
        <div style="font-size:12px; white-space:pre-wrap; line-height:1.4;">${this._linkifyText(c.noi_dung || '')}</div>
      </div>
    `).join('');

    if (donComments.length === 0) {
      commentsHtml = `<div style="font-size:11px; color:var(--clr-text-muted); font-style:italic;">Chưa có trao đổi nào.</div>`;
    }

    const commentSection = `
      <div class="kb-detail-section" style="margin-top:16px;">
        <div class="kb-detail-section-title">Trao đổi</div>
        <div id="det-comment-list" style="max-height:250px; overflow-y:auto; padding-right:4px; margin-bottom:8px;">
          ${commentsHtml}
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <textarea id="det-comment-input" class="form-textarea" rows="2" placeholder="Nhập bình luận..." style="font-size:12px;"></textarea>
          <button class="btn btn-primary btn-sm" style="align-self:flex-end;" onclick="App._submitComment('${this._escHtml(maDon)}')">Gửi</button>
        </div>
      </div>
    `;

    overlay.innerHTML = `
      <div class="kb-detail-modal" id="kb-detail-modal">
        <div class="kb-detail-header">
          <div>
            <div class="kb-detail-id">${this._escHtml(maDon)}
              ${isCancelled ? `<span class="kb-tag kb-tag-cancel">${this._escHtml(don.trang_thai)}</span>` : ''}
            </div>
            <div class="kb-detail-khach">${this._escHtml(don.ten_khach || '')}${don.brand ? ' · ' + this._escHtml(don.brand) : ''}</div>
          </div>
          <button class="kb-detail-close" onclick="App._closeCardDetail()">✕</button>
        </div>

        <div class="kb-detail-body">
          <!-- Cột trái -->
          <div class="kb-detail-left">
            <div class="kb-detail-section">
              <div class="kb-detail-section-title">Thông tin đơn</div>
              <div class="kb-detail-grid">
                ${this._detailField('Tên khách', don.ten_khach, 'det-ten-khach')}
                ${this._detailField('Brand', don.brand, 'det-brand')}
                ${this._detailField('Ngành', don.nganh, 'det-nganh')}
                ${this._detailField('Item', don.item, 'det-item')}
                ${isSaleAdmin ? this._detailField('Sale phụ trách', don.sale_phu_trach, 'det-sale') : ''}
                ${this._detailField('Ngày lên đơn', don.ngay_len_don, null, true)}
                ${ngayHetHanHtml}
              </div>
            </div>

            ${statusHtml}
            ${financeHtml}

            <div class="kb-detail-section">
              <div class="kb-detail-section-title">Nhãn ưu tiên</div>
              <div class="kb-label-checks">${labelsCheckboxHtml}</div>
            </div>

            <div class="kb-detail-section">
              <div class="kb-detail-section-title" style="display:flex;justify-content:space-between;align-items:center;">
                Brief mô tả
                ${!isDesigner ? `<button class="btn btn-ghost btn-sm" onclick="this.parentElement.parentElement.querySelector('.kb-brief-display').style.display='none'; this.parentElement.parentElement.querySelector('#det-brief').style.display='block'; this.parentElement.parentElement.querySelector('#det-brief-upload-wrapper').style.display='block'; this.style.display='none';">Sửa</button>` : ''}
              </div>
              <div class="kb-brief-display" style="white-space:pre-wrap;font-size:13px;line-height:1.5;">${briefDisplay}</div>
              ${!isDesigner ? `
                <textarea class="form-textarea" id="det-brief" rows="4" style="font-size:var(--font-size-sm); display:none; margin-top: 8px;">${this._escHtml(don.brief || '')}</textarea>
                <div id="det-brief-upload-wrapper" style="display:none; margin-top: 8px;">
                  <label class="btn btn-outline btn-sm" for="det-file-upload" style="cursor:pointer; display:inline-flex; width:auto; padding:4px 8px; margin-bottom: 4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Tải file bổ sung
                  </label>
                  <input type="file" id="det-file-upload" multiple style="display:none;" onchange="App._onDetFileSelect(event)">
                  <div id="det-file-list" style="font-size:12px; color:var(--clr-text-muted);"></div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Cột phải -->
          <div class="kb-detail-right">
            <div class="kb-detail-section">
              <div class="kb-detail-section-title">File đính kèm (${linkLines.length})</div>
              <div class="kb-detail-files">${linksHtml}</div>
            </div>

            <div class="kb-detail-section">
              <div class="kb-detail-section-title">Thông tin thêm</div>
              <div class="kb-detail-info-rows">
                <div class="kb-info-row"><span>Mã KH</span><strong>${this._escHtml(don.ma_kh||'—')}</strong></div>
                ${zaloGroupHtml}
                <div class="kb-info-row"><span>Đơn cha</span><strong>${this._escHtml(don.don_cha||'—')}</strong></div>
                ${designerHtml}
              </div>
            </div>

            ${contactHtml}
            ${commentSection}
          </div>
        </div>

        <div class="kb-detail-footer">
          <button class="btn btn-ghost" onclick="App._closeCardDetail()">Đóng</button>
          <button class="btn btn-primary" id="btn-save-detail" onclick="App._saveCardDetail('${this._escHtml(maDon)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Lưu thay đổi
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeCardDetail(); });
    requestAnimationFrame(() => overlay.classList.add('kb-overlay-visible'));
  },

  _detailField(label, value, id, readOnly = false) {
    if (readOnly) {
      return `<div class="kb-detail-field-group">
        <label class="kb-detail-label">${label}</label>
        <div class="kb-detail-value">${this._escHtml(value || '—')}</div>
      </div>`;
    }
    return `<div class="kb-detail-field-group">
      <label class="kb-detail-label">${label}</label>
      <input class="form-input" id="${id}" value="${this._escHtml(value || '')}" style="font-size:var(--font-size-sm);"/>
    </div>`;
  },

  _linkifyText(text) {
    if (!text) return '';
    const escaped = this._escHtml(text);
    // Chuyển URL thành link bấm được
    return escaped.replace(/(https?:\/\/[^\s<"]+)/g,
      url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--clr-accent);text-decoration:underline;word-break:break-all;">${url}</a>`
    ).replace(/\n/g, '<br/>');
  },

  _closeCardDetail() {
    const overlay = document.getElementById('kb-detail-overlay');
    if (!overlay) return;
    overlay.classList.remove('kb-overlay-visible');
    setTimeout(() => overlay.remove(), 250);
  },

  async _submitComment(maDon) {
    const input = document.getElementById('det-comment-input');
    const btn = input.nextElementSibling;
    const noiDung = input.value.trim();
    if (!noiDung) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;"></span> Đang gửi...';

    try {
      const email = this.session?.email;
      let nguoi = email;
      if (this._nhanSuList) {
        const ns = this._nhanSuList.find(n => n.email === email);
        if (ns && (ns.ho_ten || ns.ten_nhan_vien || ns.ten || ns.ten_designer || ns.designer)) {
           nguoi = ns.ho_ten || ns.ten_nhan_vien || ns.ten || ns.ten_designer || ns.designer;
        }
      }
      
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const thoiGian = `${dd}/${mm}/${yy} ${hh}:${min}`;

      await this._appendSheet(CONFIG.SHEETS.COMMENT, [[ maDon, nguoi, thoiGian, noiDung ]]);

      const newComment = { ma_don: maDon, nguoi, thoi_gian: thoiGian, noi_dung: noiDung };
      if (!this._commentList) this._commentList = [];
      this._commentList.push(newComment);

      const listDiv = document.getElementById('det-comment-list');
      if (listDiv) {
        if (listDiv.innerHTML.includes('Chưa có trao đổi nào')) listDiv.innerHTML = '';
        listDiv.innerHTML += `
          <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--clr-border);">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
              <strong style="font-size:12px; color:var(--clr-text);">${this._escHtml(nguoi)}</strong>
              <span style="font-size:10px; color:var(--clr-text-muted);">${this._escHtml(thoiGian)}</span>
            </div>
            <div style="font-size:12px; white-space:pre-wrap; line-height:1.4;">${this._linkifyText(noiDung)}</div>
          </div>
        `;
        listDiv.scrollTop = listDiv.scrollHeight;
      }
      input.value = '';
    } catch (e) {
      this._showToast('Lỗi gửi comment: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Gửi';
    }
  },

  _openThuTienForm(conNo) {
    document.getElementById('det-thu-tien-form').style.display='flex';
    document.getElementById('det-thu-tien-form').previousElementSibling.style.display='none';
    const sel = document.getElementById('det-thu-loai');
    const inp = document.getElementById('det-thu-tien-input');
    inp.dataset.conno = conNo;
    if (sel.value === 'thu nốt' && conNo > 0) {
      inp.value = Number(conNo).toLocaleString('vi-VN');
    }
  },

  async _submitHuyDon(maDon, daThucThu) {
    const radioA = document.getElementById('det-huy-loai-A');
    const isHoan100 = radioA && radioA.checked;
    
    const hoanInput = document.getElementById('det-huy-hoan-tien');
    const hoanTien = isHoan100 ? daThucThu : this._parseCurrency(hoanInput.value);
    
    if (hoanTien > daThucThu) {
       this._showToast(`Số tiền hoàn không được vượt quá số đã thu (${daThucThu.toLocaleString('vi-VN')} ₫)`, 'error');
       return;
    }
    
    const lyDo = document.getElementById('det-huy-ly-do').value.trim();
    
    const btn = document.querySelector('#det-huy-don-form .btn[style*="background:#c0392b"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>...'; }
    
    try {
      const trangThai = isHoan100 ? 'hủy-hoàn cọc' : 'hủy-giữ cọc';
      
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = now.getFullYear();
      const ngay = `${dd}/${mm}/${yy}`;
      
      if (hoanTien > 0) {
        const nguon = 'Pixel';
        const loai = 'hoàn cọc';
        const soTienAm = -hoanTien;
        await this._appendSheet(CONFIG.SHEETS.GIAO_DICH_TIEN, [[ maDon, ngay, loai, soTienAm, nguon ]]);
        
        if (!this._giaoDichTienList) this._giaoDichTienList = [];
        this._giaoDichTienList.push({ ma_don: maDon, ngay, loai, so_tien: soTienAm, nguon });
      }
      
      if (lyDo) {
         let currentUser = this.session?.email || '';
         if (this._nhanSuList) {
           const ns = this._nhanSuList.find(n => n.email === currentUser);
           if (ns) currentUser = ns.ten || ns.ho_ten || ns.ten_nhan_vien || ns.ten_designer || ns.designer || currentUser;
         }
         const hh = String(now.getHours()).padStart(2, '0');
         const min = String(now.getMinutes()).padStart(2, '0');
         const thoiGian = `${ngay} ${hh}:${min}`;
         const noiDung = `HỦY ĐƠN: ${lyDo}`;
         
         await this._appendSheet(CONFIG.SHEETS.COMMENT, [[ maDon, currentUser, thoiGian, noiDung ]]);
         
         if (!this._commentList) this._commentList = [];
         this._commentList.push({ ma_don: maDon, nguoi: currentUser, thoi_gian: thoiGian, noi_dung: noiDung });
      }

      // Instead of manual write sheet, we can just use the UI fields + save if it's already implemented, 
      // but _updateDonHangTrangThai is cleaner if the modal shouldn't close instantly or overwrite forms.
      const rows = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG);
      const rowIdx = rows.findIndex(r => r.ma_don === maDon);
      if (rowIdx !== -1) {
         const headerRes = await fetch(
           `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEETS.DON_HANG + '!1:1')}`,
           { headers: { Authorization: `Bearer ${this.session.accessToken}` } }
         );
         const hData = await headerRes.json();
         const headers = (hData.values || [[]])[0] || [];
         const colIdx = headers.indexOf('trang_thai');
         if (colIdx !== -1) {
            const col = this._colIndexToLetter(colIdx);
            await this._writeSheet(CONFIG.SHEETS.DON_HANG, `${col}${rowIdx + 2}`, [[trangThai]]);
         }
      }
      
      this._showToast('Đã hủy đơn thành công!', 'success');
      
      const don = this._kanbanData.find(d => d.ma_don === maDon);
      if (don) don.trang_thai = trangThai;
      
      this._openCardDetail(maDon); 
      this._renderKanbanBoard(document.getElementById('kb-search-input')?.value || '');
    } catch (e) {
      this._showToast('Lỗi khi hủy đơn: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Xác nhận hủy'; }
    }
  },

  async _submitThuTien(maDon) {
    const input = document.getElementById('det-thu-tien-input');
    const select = document.getElementById('det-thu-loai');
    const btn = input.nextElementSibling?.nextElementSibling?.querySelector('.btn-primary') || document.querySelector('#det-thu-tien-form .btn-primary');
    
    const rawVal = input.value.replace(/,/g, '');
    const soTien = this._parseCurrency(rawVal);
    if (!soTien || isNaN(soTien) || soTien <= 0) {
       this._showToast('Vui lòng nhập số tiền hợp lệ (> 0)', 'error');
       return;
    }
    
    const conNo = this._parseCurrency(input.dataset.conno);
    let rowsToInsert = [];
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = now.getFullYear();
    const ngay = `${dd}/${mm}/${yy}`;
    const nguon = 'Pixel';
    
    if (soTien > conNo && conNo > 0) {
       const tip = soTien - conNo;
       const cf = confirm(`Số tiền vượt quá phần còn nợ ${conNo.toLocaleString('vi-VN')} ₫.\\nPhần dư ${tip.toLocaleString('vi-VN')} ₫ sẽ được ghi nhận là TIP.\\nXác nhận?`);
       if (!cf) return;
       rowsToInsert.push([ maDon, ngay, 'thu nốt', conNo, nguon ]);
       rowsToInsert.push([ maDon, ngay, 'tip', tip, nguon ]);
    } else if (conNo <= 0) {
       const cf = confirm(`Đơn đã thu đủ. Khoản ${soTien.toLocaleString('vi-VN')} ₫ này sẽ được ghi nhận là TIP.\\nXác nhận?`);
       if (!cf) return;
       rowsToInsert.push([ maDon, ngay, 'tip', soTien, nguon ]);
    } else {
       rowsToInsert.push([ maDon, ngay, select.value, soTien, nguon ]);
    }
    
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>...'; }
    
    try {
      if (!this._giaoDichTienList) this._giaoDichTienList = [];
      
      for (const row of rowsToInsert) {
         await this._appendSheet(CONFIG.SHEETS.GIAO_DICH_TIEN, [row]);
         this._giaoDichTienList.push({ ma_don: row[0], ngay: row[1], loai: row[2], so_tien: row[3], nguon: row[4] });
      }
      
      this._showToast('Đã thêm giao dịch thành công!', 'success');
      this._openCardDetail(maDon); // re-render popup
    } catch (e) {
      this._showToast('Lỗi: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Xác nhận thu'; }
    }
  },

  _onDesignerSelect(selectEl) {
    const val = selectEl.value;
    if (!val) return;
    const container = document.getElementById('det-designer-tags');
    const span = document.createElement('span');
    span.className = 'kb-tag';
    span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:var(--clr-bg);border:1px solid var(--clr-border);';
    span.innerHTML = `
      ${this._escHtml(val)}
      <input type="hidden" name="assigned_designer" value="${this._escHtml(val)}" />
      <svg onclick="this.parentElement.remove(); App._updateDesignerSelect();" style="cursor:pointer;color:#E74C3C;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    `;
    container.appendChild(span);
    this._updateDesignerSelect();
  },

  _updateDesignerSelect() {
    const assigned = Array.from(document.querySelectorAll('input[name="assigned_designer"]')).map(el => el.value);
    const selectEl = document.getElementById('det-designer-select');
    if (!selectEl) return;
    const allDesigners = (this._nhanSuList || []).filter(n => n.vai_tro === 'designer').map(n => n.ten || n.ho_ten || n.ten_nhan_vien || n.email || '');
    const available = allDesigners.filter(d => d && !assigned.includes(d));
    selectEl.innerHTML = `<option value="">+ Thêm designer...</option>` + available.map(d => `<option value="${this._escHtml(d)}">${this._escHtml(d)}</option>`).join('');
  },

  _onDetFileSelect(e) {
    const files = Array.from(e.target.files);
    this._detSelectedFiles = (this._detSelectedFiles || []).concat(files);
    const list = document.getElementById('det-file-list');
    if (list) {
      list.innerHTML = this._detSelectedFiles.map((f, i) => 
        `<div style="display:flex; justify-content:space-between; margin-bottom:4px; padding:4px; background:rgba(0,0,0,0.03); border-radius:4px;">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this._escHtml(f.name)}</span>
          <button style="background:none; border:none; cursor:pointer; color:#E74C3C;" onclick="App._removeDetFile(${i})">✕</button>
        </div>`
      ).join('');
    }
    e.target.value = '';
  },

  _removeDetFile(idx) {
    if (this._detSelectedFiles) {
      this._detSelectedFiles.splice(idx, 1);
      this._onDetFileSelect({target: {files: []}});
    }
  },

  async _saveCardDetail(maDon) {
    const btn = document.getElementById('btn-save-detail');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Đang lưu...'; }

    const isDesigner = this.session?.role === 'designer';

    const rawDt = document.getElementById('det-ngay-het-han')?.value;
    let formattedDt = '';
    if (rawDt) {
      const dateObj = new Date(rawDt);
      if (!isNaN(dateObj)) {
         const dd = String(dateObj.getDate()).padStart(2, '0');
         const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
         const yy = dateObj.getFullYear();
         const hh = String(dateObj.getHours()).padStart(2, '0');
         const min = String(dateObj.getMinutes()).padStart(2, '0');
         formattedDt = `${dd}/${mm}/${yy} ${hh}:${min}`;
      }
    }

    const patch = {
      ten_khach:      document.getElementById('det-ten-khach')?.value.trim(),
      brand:          document.getElementById('det-brand')?.value.trim(),
      nganh:          document.getElementById('det-nganh')?.value.trim(),
      item:           document.getElementById('det-item')?.value.trim(),
      ngay_het_han:   formattedDt || rawDt || '',
      ...(isDesigner ? {} : {
        sale_phu_trach: document.getElementById('det-sale')?.value.trim(),
        brief:          document.getElementById('det-brief')?.value.trim(),
        cot_kanban:     document.getElementById('det-cot-kanban')?.value,
        trang_thai:     document.getElementById('det-trang-thai')?.value,
      }),
    };
    if (!isDesigner && document.getElementById('det-brief')) {
      patch.brief = document.getElementById('det-brief').value.trim();
    }

    const don = this._kanbanData.find(d => d.ma_don === maDon);
    if (!don) throw new Error('Không tìm thấy đơn ' + maDon);

    // Upload file bổ sung nếu có
    if (!isDesigner && this._detSelectedFiles?.length > 0) {
      if (btn) btn.innerHTML = '<span class="spinner"></span> Đang tải file...';
      const newLinks = await this._uploadAnhLenDrive(this._detSelectedFiles, maDon);
      if (newLinks) {
        const cur = don.link_anh ? don.link_anh.trim() : '';
        patch.link_anh = cur ? (cur + '\n' + newLinks) : newLinks;
      }
    }

    // Thu thập nhãn được chọn
    const checkedLabels = [...document.querySelectorAll('.kb-label-cb:checked')].map(cb => ({
      nhan: cb.value,
      mau:  cb.dataset.mau || '#999',
    }));

    try {
      const rows = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG);
      const rowIdx = rows.findIndex(r => r.ma_don === maDon);
      if (rowIdx === -1) throw new Error('Không tìm thấy đơn ' + maDon);

      const headerRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEETS.DON_HANG + '!1:1')}`,
        { headers: { Authorization: `Bearer ${this.session.accessToken}` } }
      );
      const hData = await headerRes.json();
      const headers = (hData.values || [[]])[0] || [];
      const sheetRow = rowIdx + 2;

      // Ghi từng cột có thay đổi
      const writes = Object.entries(patch).map(([key, val]) => {
        const colIdx = headers.indexOf(key);
        if (colIdx === -1 || val === undefined) return null;
        const col = this._colIndexToLetter(colIdx);
        return this._writeSheet(CONFIG.SHEETS.DON_HANG, `${col}${sheetRow}`, [[val]]);
      }).filter(Boolean);

      // Lưu nhãn vào NHAN_DON
      writes.push(this._saveLabels(maDon, checkedLabels));

      await Promise.all(writes);

      // Cập nhật local cache
      this._kanbanLabelMap[maDon] = checkedLabels;

      // Update DIEM_DESIGNER (admin/leader/sale only)
      const isRoleSaleAdmin = ['admin', 'leader', 'sale'].includes(this.session?.role);
      if (isRoleSaleAdmin && document.getElementById('det-designer-tags')) {
        const assignedDesigners = Array.from(document.querySelectorAll('input[name="assigned_designer"]')).map(el => el.value);
        
        const scoreInputs = {};
        assignedDesigners.forEach(d => {
           const inp = document.querySelector(`input[name="designer_score_${d}"]`);
           if (inp) {
              // Chuẩn hóa dấu phẩy thành dấu chấm
              scoreInputs[d] = inp.value.replace(/,/g, '.').replace(/[^0-9.]/g, '').trim();
           }
        });

        // Read current DIEM_DESIGNER
        const rawDiem = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.DIEM_DESIGNER).catch(() => []);
        
        // Find rows for maDon
        const rowsForDon = [];
        rawDiem.forEach((row, idx) => {
          if (row.ma_don === maDon) rowsForDon.push({ ...row, rowIndex: idx + 2 }); // +1 for 0-index, +1 for header
        });

        const oldDesigners = rowsForDon.map(r => r.ten_designer || r.designer || r.ho_ten || r.ten || '');
        
        const toRemove = rowsForDon.filter(r => {
          const t = r.ten_designer || r.designer || r.ho_ten || r.ten || '';
          return !assignedDesigners.includes(t);
        });
        
        const toAdd = assignedDesigners.filter(d => !oldDesigners.includes(d));

        const toUpdateScore = rowsForDon.filter(r => {
          const t = r.ten_designer || r.designer || r.ho_ten || r.ten || '';
          if (!assignedDesigners.includes(t)) return false;
          const newScore = scoreInputs[t] || '';
          const oldScore = r.diem || '';
          return newScore !== oldScore;
        });

        const diemWrites = [];

        // Execute removes by clearing rows
        for (const r of toRemove) {
          diemWrites.push(this._writeSheet(CONFIG.SHEETS.DIEM_DESIGNER, `A${r.rowIndex}:C${r.rowIndex}`, [['', '', '']]));
        }
        
        // Execute adds
        if (toAdd.length > 0) {
          const appendData = toAdd.map(d => [maDon, d, scoreInputs[d] || '']);
          diemWrites.push(this._appendSheet(CONFIG.SHEETS.DIEM_DESIGNER, appendData));
        }

        // Execute updates
        for (const r of toUpdateScore) {
          const t = r.ten_designer || r.designer || r.ho_ten || r.ten || '';
          const newScore = scoreInputs[t] || '';
          diemWrites.push(this._writeSheet(CONFIG.SHEETS.DIEM_DESIGNER, `C${r.rowIndex}`, [[newScore]]));
        }
        
        if (diemWrites.length > 0) {
           await Promise.all(diemWrites);
        }
        
        // Update local cache
        this._kanbanDesignerMap[maDon] = assignedDesigners;
        if (!this._kanbanDesignerScoreMap) this._kanbanDesignerScoreMap = {};
        if (!this._kanbanDesignerScoreMap[maDon]) this._kanbanDesignerScoreMap[maDon] = {};
        assignedDesigners.forEach(d => {
           this._kanbanDesignerScoreMap[maDon][d] = scoreInputs[d] || '';
        });
      }
      
      // Build updated don object
      Object.assign(don, patch);

      this._showToast(`✅ Đã lưu thay đổi cho ${maDon}`, 'success', 3000);
      this._renderKanbanBoard(document.getElementById('kb-search-input')?.value || '');
      // Re-render popup to show updated files
      this._openCardDetail(maDon);
    } catch (e) {
      this._showToast('Lỗi lưu: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Lưu thay đổi'; }
    }
  },

  async _saveLabels(maDon, newLabels) {
    // Đọc tất cả NHAN_DON thô (không parse header) để giữ lại dữ liệu đơn khác
    const token  = this.session?.accessToken;
    const url    = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEETS.NHAN_DON)}`;
    let allRows  = [];
    let hasHeader = false;
    try {
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      allRows    = data.values || [];
      hasHeader  = allRows.length > 0;
    } catch (_) {}

    // Giữ header + lọc bỏ đơn hiện tại
    const header    = hasHeader ? allRows[0] : ['ma_don','nhan','mau'];
    const otherRows = (hasHeader ? allRows.slice(1) : []).filter(r => r[0] !== maDon);
    const newRows   = newLabels.map(l => [maDon, l.nhan, l.mau]);
    const finalData = [header, ...otherRows, ...newRows];

    // Clear sheet rồi ghi lại
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEETS.NHAN_DON)}:clear`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    if (finalData.length > 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEETS.NHAN_DON + '!A1')}?valueInputOption=USER_ENTERED`,
        {
          method:  'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ range: CONFIG.SHEETS.NHAN_DON + '!A1', majorDimension: 'ROWS', values: finalData }),
        }
      );
    }
    // Cập nhật raw cache
    this._kanbanNhanDonRaw = (hasHeader ? allRows.slice(1) : [])
      .filter(r => r[0] !== maDon)
      .concat(newRows)
      .map(r => ({ ma_don: r[0], nhan: r[1], mau: r[2] }));
  },

  _showConfirm(msg, btnOkText, btnCancelText) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'kb-overlay';
      overlay.style.zIndex = '9999';
      overlay.innerHTML = `
        <div class="kb-detail-modal" style="max-width: 400px; padding: 24px; text-align: center;">
          <p style="font-size: 15px; margin-bottom: 24px; color: var(--clr-text); line-height: 1.5; white-space: pre-wrap;">${this._escHtml(msg)}</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn btn-ghost" id="btn-cfm-cancel">${this._escHtml(btnCancelText)}</button>
            <button class="btn btn-primary" id="btn-cfm-ok">${this._escHtml(btnOkText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('kb-overlay-visible'));

      const close = (res) => {
        overlay.classList.remove('kb-overlay-visible');
        setTimeout(() => overlay.remove(), 250);
        resolve(res);
      };

      overlay.querySelector('#btn-cfm-ok').onclick = () => close(true);
      overlay.querySelector('#btn-cfm-cancel').onclick = () => close(false);
    });
  },

  // ==========================================
  // KÉO DOANH THU PIXEL
  // ==========================================
  async renderKeoDoanhThuPixelPage() {
    const content = document.getElementById('page-content');
    content.style.padding = '12px';
    content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0;flex-direction:column;gap:16px;">
      <div class="spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(138,114,76,0.2);border-top-color:var(--clr-accent);"></div>
      <p style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Đang tải dữ liệu doanh thu Pixel...</p>
    </div>`;

    try {
      // Đọc ĐÚNG các file gốc của app PIXEL:
      //  - GIAO_DICH_TIEN, TIEN_DON  -> file TAI-CHINH  (định tuyến tự động)
      //  - DON_HANG, DANH_MUC_*      -> file crm-data   (chỉ định rõ OPERATION_SPREADSHEET_ID)
      // DON_HANG đọc TOÀN BỘ cột (không giới hạn A:T) để lấy được cột da_an.
      const [gdData, donData, danhMucNganh, danhMucItem, tienDonData] = await Promise.all([
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.GIAO_DICH_TIEN, 'A:E'),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, '', CONFIG.OPERATION_SPREADSHEET_ID),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DANH_MUC_NGANH, '', CONFIG.OPERATION_SPREADSHEET_ID),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DANH_MUC_ITEM, '', CONFIG.OPERATION_SPREADSHEET_ID),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.TIEN_DON, 'A:B').catch(() => [])
      ]);

      this._doanhThuData = gdData || [];
      const donHangList = (donData || []).filter(d => d.da_an !== 'yes');
      this._doanhThuDonHangList = donHangList;
      const tienDonList = tienDonData || [];

      const tienDonMap = {};
      tienDonList.forEach(row => { if (row.ma_don) tienDonMap[row.ma_don] = row.tong_gia_tri; });
      donHangList.forEach(d => { if (tienDonMap[d.ma_don] !== undefined) d.tong_gia_tri = tienDonMap[d.ma_don]; });

      const donMap = {};
      donHangList.forEach(d => {
        if (d.ma_don) {
          donMap[d.ma_don] = {
            nganh: d.nganh || '',
            sale_phu_trach: d.sale_phu_trach || '',
            ma_kh: d.ma_kh || '',
            item: d.item || ''
          };
        }
      });

      const uniqueSale = new Set();
      const uniqueKh = new Set();
      const uniqueLoai = new Set();

      this._doanhThuData = this._doanhThuData.filter(r => {
        const donInfo = donMap[r.ma_don];
        if (!donInfo) return false; // Bỏ giao dịch của đơn đã ẩn hoặc không tồn tại

        if (r.ngay) {
          const [d, m, y] = r.ngay.split('/');
          r.parsedDate = new Date(y, m - 1, d);
        } else {
          r.parsedDate = new Date(0);
        }
        r.so_tien = this._parseCurrency(r.so_tien);

        r.nganh = donInfo.nganh;
        r.sale_phu_trach = donInfo.sale_phu_trach;
        r.ma_kh = donInfo.ma_kh;
        r.item = donInfo.item;

        if (r.sale_phu_trach) uniqueSale.add(r.sale_phu_trach);
        if (r.ma_kh) uniqueKh.add(r.ma_kh);
        if (r.loai) uniqueLoai.add(r.loai);

        return true;
      });

      this._doanhThuFilters = {
        nganh: (danhMucNganh || []).map(r => r.ten_nganh).filter(Boolean),
        sale: Array.from(uniqueSale).sort(),
        kh: Array.from(uniqueKh).sort(),
        item: (danhMucItem || []).map(r => r.ten_item).filter(Boolean),
        loai: Array.from(uniqueLoai).sort()
      };

      this._renderDoanhThuContent('month');
    } catch (e) {
      console.error(e);
      content.innerHTML = `<div style="color:var(--clr-error); padding:24px;">Lỗi tải dữ liệu: ${this._escHtml(e.message)}</div>`;
    }
  },

  _renderKeoDoanhThuPixelContent(filterType = 'month', customFrom = '', customTo = '', fNganh = 'all', fSale = 'all', fKh = 'all', fItem = 'all', fLoai = 'all') {
    const content = document.getElementById('page-content');
    const today = new Date();
    let startDate, endDate;

    if (filterType === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterType === 'last_month') {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    } else if (filterType === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      startDate = new Date(today.getFullYear(), q * 3, 1);
      endDate = new Date(today.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
    } else if (filterType === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filterType === 'custom') {
      startDate = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(0);
      endDate = customTo ? new Date(customTo + 'T23:59:59') : new Date('2999-12-31');
    }

    let tongDoanhThu = 0;
    let tongThu = 0;
    let tongHoan = 0;
    let tongTip = 0;
    let soGiaoDich = 0;

    const dailyMap = {};
    this._keoDoanhThuCurrentFilteredData = [];

    this._keoDoanhThuData.forEach(r => {
      if (r.parsedDate < startDate || r.parsedDate > endDate) return;

      if (fNganh !== 'all' && r.nganh !== fNganh) return;
      if (fSale !== 'all' && r.sale_phu_trach !== fSale) return;
      if (fKh !== 'all' && r.ma_kh !== fKh) return;
      if (fItem !== 'all' && r.item !== fItem) return;
      if (fLoai !== 'all' && r.loai !== fLoai) return;

      const tien = r.so_tien;
      tongDoanhThu += tien;
      soGiaoDich++;

      if (tien > 0) tongThu += tien;
      if (tien < 0) tongHoan += Math.abs(tien);
      if (r.loai && r.loai.toLowerCase() === 'tip') tongTip += tien;

      const dateStr = r.ngay || 'Chưa rõ';
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, parsedDate: r.parsedDate, total: 0, count: 0 };
      }
      dailyMap[dateStr].total += tien;
      dailyMap[dateStr].count += 1;
      this._keoDoanhThuCurrentFilteredData.push(r);
    });

    const dailyArr = Object.values(dailyMap).sort((a, b) => b.parsedDate - a.parsedDate);
    
    this._keoDoanhThuCurrentExport = dailyArr;

    const btnStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-border-light); background:var(--clr-surface); cursor:pointer; font-size:13px; font-weight:500; color:var(--clr-text); transition:all 0.2s;";
    const btnActiveStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-accent); background:var(--clr-accent); color:#fff; cursor:pointer; font-size:13px; font-weight:500; transition:all 0.2s;";
    const selectStyle = "padding:6px 10px; border-radius:8px; border:1px solid var(--clr-border-light); font-size:13px; background:var(--clr-surface); max-width:150px;";

    const buildOptions = (arr, currentVal) => {
      let html = `<option value="all">Tất cả</option>`;
      arr.forEach(item => {
        const selected = item === currentVal ? 'selected' : '';
        html += `<option value="${this._escHtml(item)}" ${selected}>${this._escHtml(item)}</option>`;
      });
      return html;
    };

    const filterOnChange = `App._renderKeoDoanhThuPixelContent('${filterType}', '${customFrom}', '${customTo}', document.getElementById('kdt-nganh').value, document.getElementById('kdt-sale').value, document.getElementById('kdt-kh').value, document.getElementById('kdt-item').value, document.getElementById('kdt-loai').value)`;
    const resetFilterClick = `App._renderKeoDoanhThuPixelContent('month', '', '', 'all', 'all', 'all', 'all', 'all')`;

    content.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; display:flex; flex-direction:column; gap:24px;">
        
        <!-- BỘ LỌC -->
        <div style="background:var(--clr-card); padding:20px; border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:16px;">
          
          <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button style="${filterType === 'month' ? btnActiveStyle : btnStyle}" onclick="App._renderKeoDoanhThuPixelContent('month', '', '', '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Tháng này</button>
              <button style="${filterType === 'last_month' ? btnActiveStyle : btnStyle}" onclick="App._renderKeoDoanhThuPixelContent('last_month', '', '', '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Tháng trước</button>
              <button style="${filterType === 'quarter' ? btnActiveStyle : btnStyle}" onclick="App._renderKeoDoanhThuPixelContent('quarter', '', '', '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Quý này</button>
              <button style="${filterType === 'year' ? btnActiveStyle : btnStyle}" onclick="App._renderKeoDoanhThuPixelContent('year', '', '', '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Năm nay</button>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <span style="font-size:14px; font-weight:500;">Hoặc chọn ngày:</span>
              <div class="custom-date-wrapper" style="width:140px;">
                <input type="date" onclick="this.showPicker()" id="kdt-from" class="form-input custom-date-input" style="width:100%; padding:6px 10px; background:transparent;" value="${customFrom}">
                <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span style="color:var(--clr-text-muted);">-</span>
              <div class="custom-date-wrapper" style="width:140px;">
                <input type="date" onclick="this.showPicker()" id="kdt-to" class="form-input custom-date-input" style="width:100%; padding:6px 10px; background:transparent;" value="${customTo}">
                <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <button class="btn btn-outline btn-sm" onclick="App._renderKeoDoanhThuPixelContent('custom', document.getElementById('kdt-from').value, document.getElementById('kdt-to').value, '${this._escHtml(fNganh)}', '${this._escHtml(fSale)}', '${this._escHtml(fKh)}', '${this._escHtml(fItem)}', '${this._escHtml(fLoai)}')">Lọc</button>
            </div>
          </div>

          <div style="border-top:1px dashed var(--clr-border-light); margin:4px 0;"></div>

          <!-- BỘ LỌC KẾT HỢP -->
          <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Ngành:</label>
              <select id="kdt-nganh" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._keoDoanhThuFilters.nganh, fNganh)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Sale:</label>
              <select id="kdt-sale" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._keoDoanhThuFilters.sale, fSale)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Mã KH:</label>
              <select id="kdt-kh" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._keoDoanhThuFilters.kh, fKh)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Item:</label>
              <select id="kdt-item" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._keoDoanhThuFilters.item, fItem)}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-size:13px; font-weight:500;">Loại giao dịch:</label>
              <select id="kdt-loai" style="${selectStyle}" onchange="${filterOnChange}">
                ${buildOptions(this._keoDoanhThuFilters.loai, fLoai)}
              </select>
            </div>
            <div style="flex-grow:1; text-align:right;">
              <button class="btn btn-ghost btn-sm" onclick="${resetFilterClick}" style="color:var(--clr-error);">Xóa bộ lọc</button>
            </div>
          </div>
        </div>

        <!-- CHỈ SỐ TỔNG -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:24px;">
          <div class="trendy-stat-card trendy-stat-1">
            <div class="stat-label-trendy">Tổng doanh thu</div>
            <div class="stat-num-trendy">${this._formatVND(tongDoanhThu)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
          <div class="trendy-stat-card trendy-stat-2">
            <div class="stat-label-trendy">Tổng thu</div>
            <div class="stat-num-trendy">${this._formatVND(tongThu)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
          <div class="trendy-stat-card trendy-stat-3">
            <div class="stat-label-trendy">Tổng hoàn</div>
            <div class="stat-num-trendy">${this._formatVND(tongHoan)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
          <div class="trendy-stat-card trendy-stat-4">
            <div class="stat-label-trendy">Tổng tip</div>
            <div class="stat-num-trendy">${this._formatVND(tongTip)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
          <div class="trendy-stat-card trendy-stat-1">
            <div class="stat-label-trendy">Số giao dịch</div>
            <div class="stat-num-trendy">${this._formatNumber(soGiaoDich)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
        </div>

        <!-- BIỂU ĐỒ -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:16px; margin-bottom:16px;">
          <!-- Biểu đồ đường (Trend) -->
          <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px; display:flex; flex-direction:column;">
            <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">Xu hướng Doanh thu</h3>
            <div style="flex-grow:1; min-height:300px; position:relative; display:flex; justify-content:center; align-items:center;">
              <canvas id="kdt-chart-trend"></canvas>
              <div id="kdt-chart-trend-empty" style="display:none; color:var(--clr-text-muted); font-size:14px; position:absolute;">Không có dữ liệu để vẽ biểu đồ</div>
            </div>
          </div>
          <!-- Biểu đồ tỷ trọng -->
          <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px; display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="margin:0; font-size:16px; font-weight:600;">Cơ cấu Doanh thu</h3>
              <select id="kdt-chart-pie-dimension" class="form-select" style="width:auto; padding:4px 24px 4px 8px; font-size:13px;" onchange="App._drawKeoDoanhThuPieChart(this.value)">
                <option value="nganh">Theo Ngành</option>
                <option value="sale_phu_trach">Theo Sale</option>
                <option value="item">Theo Item</option>
              </select>
            </div>
            <div style="flex-grow:1; min-height:300px; position:relative; display:flex; justify-content:center; align-items:center;">
              <canvas id="kdt-chart-pie"></canvas>
              <div id="kdt-chart-pie-empty" style="display:none; color:var(--clr-text-muted); font-size:14px; position:absolute;">Không có dữ liệu để vẽ biểu đồ</div>
            </div>
          </div>
        </div>

        <!-- BẢNG THEO NGÀY -->
        <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden;">
          <div style="padding:20px; border-bottom:1px solid var(--clr-border-light); display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:16px; font-weight:600;">Doanh thu theo ngày</h3>
            <button class="btn btn-outline btn-sm" onclick="App._exportKeoDoanhThuCsv()">
              <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right:6px;" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Xuất Excel
            </button>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
              <thead>
                <tr style="background:rgba(0,0,0,0.02); color:var(--clr-text-muted); font-size:12px; text-transform:uppercase; letter-spacing:0.05em; text-align:left;">
                  <th style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light);">Ngày</th>
                  <th style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); text-align:center;">Số giao dịch</th>
                  <th style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); text-align:right;">Tổng thu trong ngày</th>
                </tr>
              </thead>
              <tbody>
                ${dailyArr.length > 0 ? dailyArr.map(r => `
                  <tr class="table-row-hover">
                    <td style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); font-weight:500;">${r.date}</td>
                    <td style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); text-align:center;">${r.count}</td>
                    <td style="padding:16px 20px; border-bottom:1px solid var(--clr-border-light); text-align:right; font-weight:600; color:${r.total >= 0 ? 'var(--clr-accent)' : '#E74C3C'}">${this._formatVND(r.total)}</td>
                  </tr>
                `).join('') : `<tr><td colspan="3" style="padding:32px; text-align:center; color:var(--clr-text-muted);">Không có doanh thu trong kỳ này</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    setTimeout(() => this._initKeoDoanhThuCharts(dailyArr), 100);
  },

  _initKeoDoanhThuCharts(dailyArr) {
    if (!window.Chart) return;
    this._keoDoanhThuCharts = this._keoDoanhThuCharts || {};

    if (this._keoDoanhThuCharts.trend) {
      this._keoDoanhThuCharts.trend.destroy();
    }
    
    const canvasTrend = document.getElementById('kdt-chart-trend');
    const emptyTrend = document.getElementById('kdt-chart-trend-empty');
    if (canvasTrend && emptyTrend) {
      if (!dailyArr || dailyArr.length === 0) {
        canvasTrend.style.display = 'none';
        emptyTrend.style.display = 'block';
      } else {
        canvasTrend.style.display = 'block';
        emptyTrend.style.display = 'none';

        const chartData = [...dailyArr].reverse();
        const labels = chartData.map(r => r.date.substring(0, 5)); 

        const makeGrad = (c, r, g, b, alpha = 0.35) => {
          if (!c.chart.chartArea) return `rgba(${r},${g},${b},${alpha})`;
          const ctx = c.chart.ctx;
          const area = c.chart.chartArea;
          const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
          gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
          gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
          return gradient;
        };

        this._keoDoanhThuCharts.trend = new Chart(canvasTrend, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Doanh thu (VNĐ)',
              data: chartData.map(r => r.total),
              borderColor: '#B7A88F',
              backgroundColor: (c) => makeGrad(c, 183, 168, 143),
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#B7A88F',
              pointRadius: 3,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => Number(c.raw).toLocaleString('vi-VN') + ' đ' } }
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#9E8E82', font: { size: 11 } } },
              y: { beginAtZero: true, grid: { color: 'rgba(100,80,60,0.03)', drawBorder: false }, ticks: { color: '#9E8E82', font: { size: 11 } } }
            }
          }
        });
      }
    }

    const dimSelect = document.getElementById('kdt-chart-pie-dimension');
    if (dimSelect) {
      this._drawKeoDoanhThuPieChart(dimSelect.value);
    }
  },

  _drawKeoDoanhThuPieChart(dimension) {
    if (!window.Chart) return;
    this._keoDoanhThuCharts = this._keoDoanhThuCharts || {};
    
    if (this._keoDoanhThuCharts.pie) {
      this._keoDoanhThuCharts.pie.destroy();
    }

    const canvasPie = document.getElementById('kdt-chart-pie');
    const emptyPie = document.getElementById('kdt-chart-pie-empty');
    if (!canvasPie || !emptyPie) return;

    if (!this._keoDoanhThuCurrentFilteredData || this._keoDoanhThuCurrentFilteredData.length === 0) {
      canvasPie.style.display = 'none';
      emptyPie.style.display = 'block';
      return;
    }

    const mapGroup = {};
    this._keoDoanhThuCurrentFilteredData.forEach(r => {
      let key = r[dimension];
      if (typeof key === 'string') key = key.trim();
      if (!key) key = 'Không xác định';
      if (!mapGroup[key]) mapGroup[key] = 0;
      mapGroup[key] += r.so_tien;
    });

    const keys = [];
    const values = [];
    Object.entries(mapGroup)
      .sort((a, b) => b[1] - a[1]) // Giảm dần
      .forEach(([k, v]) => {
        if (v > 0) {
          keys.push(k);
          values.push(v);
        }
      });

    if (values.length === 0) {
      canvasPie.style.display = 'none';
      emptyPie.style.display = 'block';
      return;
    }

    canvasPie.style.display = 'block';
    emptyPie.style.display = 'none';

    this._keoDoanhThuCharts.pie = new Chart(canvasPie, {
      type: 'bar',
      data: {
        labels: keys,
        datasets: [{
          label: 'Doanh thu',
          data: values,
          backgroundColor: '#B7A88F',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                return 'Doanh thu: ' + App._formatVND(val);
              }
            }
          }
        },
        scales: {
          x: { display: false, beginAtZero: true, grid: { display: false } },
          y: { grid: { display: false }, ticks: { color: '#6B5E52', font: { size: 12, weight: '500' } } }
        }
      }
    });
  },

  _exportKeoDoanhThuCsv() {
    if (!this._keoDoanhThuCurrentExport || this._keoDoanhThuCurrentExport.length === 0) {
      this._showToast('Không có dữ liệu để xuất.', 'error');
      return;
    }
    const headers = ['Ngày', 'Số giao dịch', 'Tổng thu trong ngày'];
    const rows = this._keoDoanhThuCurrentExport.map(r => [
      r.date, 
      r.count, 
      r.total
    ]);
    
    // Add BOM for Excel UTF-8
    let csvContent = '\uFEFF' + headers.join(',') + '\n';
    rows.forEach(r => {
      csvContent += r.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Keo_Doanh_Thu_Pixel_${this._formatDateToday().replace(/\\//g,'-')}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ==========================================
  // PHÂN TÍCH TỔNG (ETSY + PIXEL)
  // ==========================================
  async renderPhanTichTongPage() {
    const content = document.getElementById('page-content');
    content.style.padding = '24px';
    content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0;flex-direction:column;gap:16px;">
      <div class="spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(138,114,76,0.2);border-top-color:var(--clr-accent);"></div>
      <p style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Đang tải dữ liệu tổng hợp...</p>
    </div>`;

    try {
      const [etsyRaw, pixelRaw, donRaw, tienDonRaw] = await Promise.all([
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DOANH_THU_KHAC).catch((e) => {
          this._showToast(`Lỗi đọc Etsy: ${e.message}`, 'error');
          return [];
        }),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.GIAO_DICH_TIEN, 'A:E').catch((e) => {
          this._showToast(`Lỗi đọc Pixel: ${e.message}`, 'error');
          return [];
        }),
        // Danh sach don de loai giao dich cua don da an / khong con ton tai
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, '', CONFIG.OPERATION_SPREADSHEET_ID).catch(() => []),
        // Gia tri don nam o file TAI-CHINH, phai ghep vao moi tinh duoc doanh so
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.TIEN_DON, 'A:B').catch(() => [])
      ]);

      const donList = (donRaw || []).filter(d => d.ma_don && d.da_an !== 'yes');
      const donHopLe = {};
      donList.forEach(d => { donHopLe[d.ma_don] = true; });

      const tienDonMap = {};
      (tienDonRaw || []).forEach(row => { if (row.ma_don) tienDonMap[row.ma_don] = row.tong_gia_tri; });
      donList.forEach(d => { if (tienDonMap[d.ma_don] !== undefined) d.tong_gia_tri = tienDonMap[d.ma_don]; });

      // Xử lý dữ liệu Etsy
      let etsyRecords = etsyRaw.map((d, i) => ({
        ...d,
        _origIndex: i,
        parsedDate: new Date(d.ngay || 0),
        so_tien: parseInt((d.so_tien || '').replace(/[^0-9-]/g, ''), 10) || 0
      }));
      etsyRecords.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

      const shopLastCumulative = {};
      for (const rec of etsyRecords) {
        const shop = rec.nguon;
        if (shopLastCumulative[shop] === undefined) {
          rec.doanh_thu_phat_sinh = rec.so_tien;
        } else {
          rec.doanh_thu_phat_sinh = rec.so_tien - shopLastCumulative[shop];
        }
        shopLastCumulative[shop] = rec.so_tien;
      }

      this._phanTichTongData = [];

      // Gom Etsy vào _phanTichTongData
      etsyRecords.forEach(r => {
        // Etsy: khach tra ngay tren san, khong co cong no
        // -> doanh so va tien thuc thu la MOT con so
        this._phanTichTongData.push({
          source: 'etsy',
          muc: 'ca_hai',
          parsedDate: r.parsedDate,
          ngayStr: r.ngay,
          tien: r.doanh_thu_phat_sinh || 0
        });
      });

      // Gom Pixel vào _phanTichTongData
      // Pixel: chi tinh TIEN THUC THU trong ky
      //  - bo giao dich cua don da an / khong con ton tai
      //  - bo tien tip (khong phai doanh thu ban hang)
      //  - bo khoan am (hoan tien) de khong lam meo ty trong
      // Muc nay tuong duong voi "doanh thu net" cua Etsy: tien thuc su ve.
      pixelRaw.forEach(r => {
        if (!donHopLe[r.ma_don]) return;
        const isTip = r.loai && r.loai.toLowerCase() === 'tip';
        if (isTip) return;
        const tienPixel = this._parseCurrency(r.so_tien) || 0;
        if (tienPixel <= 0) return;

        let pDate = new Date(0);
        if (r.ngay) {
          const [d, m, y] = r.ngay.split('/');
          pDate = new Date(y, m - 1, d);
        }
        this._phanTichTongData.push({
          source: 'pixel',
          muc: 'thu',
          parsedDate: pDate,
          ngayStr: r.ngay,
          tien: tienPixel
        });
      });

      // Pixel: DOANH SO GHI NHAN = gia tri cac don LEN trong ky
      // (theo ngay_len_don, khong phai ngay tra tien)
      donList.forEach(d => {
        const raw = d.ngay_len_don || d.ngay_tao || '';
        if (!raw) return;
        const parts = raw.trim().split('/');
        if (parts.length < 3) return;
        const dd = parseInt(parts[0], 10), mm = parseInt(parts[1], 10), yy = parseInt(parts[2], 10);
        if (isNaN(dd) || isNaN(mm) || isNaN(yy)) return;
        const phaiThu = this._tinhSoPhaiThu(d);
        if (phaiThu <= 0) return;
        this._phanTichTongData.push({
          source: 'pixel',
          muc: 'doanhso',
          parsedDate: new Date(yy, mm - 1, dd),
          ngayStr: raw,
          tien: phaiThu
        });
      });

      this._renderPhanTichTongContent('month');

    } catch (e) {
      console.error(e);
      content.innerHTML = `<div style="color:var(--clr-error); padding:24px;">Lỗi tải dữ liệu: ${this._escHtml(e.message)}</div>`;
    }
  },

  _renderPhanTichTongContent(filterType = 'month', customFrom = '', customTo = '') {
    const content = document.getElementById('page-content');
    const today = new Date();
    let startDate, endDate;

    if (filterType === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterType === 'last_month') {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    } else if (filterType === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filterType === 'all') {
      startDate = new Date(0);
      endDate = new Date('2999-12-31');
    } else if (filterType === 'custom') {
      startDate = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(0);
      endDate = customTo ? new Date(customTo + 'T23:59:59') : new Date('2999-12-31');
    }

    // Hai thuoc do song song:
    //  - THUC THU : tien da ve trong ky
    //  - DOANH SO : gia tri ghi nhan trong ky (Pixel tinh theo ngay len don)
    let tongGop = 0, tongPixel = 0, tongEtsy = 0;
    let dsGop = 0,   dsPixel = 0,   dsEtsy = 0;

    const dailyMap = {};

    this._phanTichTongData.forEach(r => {
      if (r.parsedDate < startDate || r.parsedDate > endDate) return;

      const tien = r.tien;
      const laThu     = (r.muc === 'thu'     || r.muc === 'ca_hai');
      const laDoanhSo = (r.muc === 'doanhso' || r.muc === 'ca_hai');

      if (laDoanhSo) {
        dsGop += tien;
        if (r.source === 'pixel') dsPixel += tien; else if (r.source === 'etsy') dsEtsy += tien;
      }

      if (!laThu) return;   // phan duoi (bieu do, ty trong) dua tren TIEN THUC THU

      tongGop += tien;
      if (r.source === 'pixel') tongPixel += tien;
      else if (r.source === 'etsy') tongEtsy += tien;

      const dStr = r.ngayStr || 'Chưa rõ';
      if (!dailyMap[dStr]) {
        dailyMap[dStr] = { date: dStr, parsedDate: r.parsedDate, pixel: 0, etsy: 0, total: 0 };
      }

      dailyMap[dStr].total += tien;
      if (r.source === 'pixel') dailyMap[dStr].pixel += tien;
      if (r.source === 'etsy') dailyMap[dStr].etsy += tien;
    });

    const dailyArr = Object.values(dailyMap).sort((a, b) => a.parsedDate - b.parsedDate);

    const btnStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-border-light); background:var(--clr-surface); cursor:pointer; font-size:13px; font-weight:500; color:var(--clr-text); transition:all 0.2s;";
    const btnActiveStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-accent); background:var(--clr-accent); color:#fff; cursor:pointer; font-size:13px; font-weight:500; transition:all 0.2s;";

    content.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; display:flex; flex-direction:column; gap:24px;">
        
        <!-- BỘ LỌC -->
        <div style="background:var(--clr-card); padding:20px; border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button style="${filterType === 'month' ? btnActiveStyle : btnStyle}" onclick="App._renderPhanTichTongContent('month')">Tháng này</button>
            <button style="${filterType === 'last_month' ? btnActiveStyle : btnStyle}" onclick="App._renderPhanTichTongContent('last_month')">Tháng trước</button>
            <button style="${filterType === 'year' ? btnActiveStyle : btnStyle}" onclick="App._renderPhanTichTongContent('year')">Năm nay</button>
            <button style="${filterType === 'all' ? btnActiveStyle : btnStyle}" onclick="App._renderPhanTichTongContent('all')">Tất cả</button>
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <span style="font-size:14px; font-weight:500;">Từ:</span>
            <div class="custom-date-wrapper" style="width:140px;">
              <input type="date" onclick="this.showPicker()" id="ptt-from" class="form-input custom-date-input" style="width:100%; padding:6px 10px; background:transparent;" value="${customFrom}">
              <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <span style="font-size:14px; font-weight:500;">Đến:</span>
            <div class="custom-date-wrapper" style="width:140px;">
              <input type="date" onclick="this.showPicker()" id="ptt-to" class="form-input custom-date-input" style="width:100%; padding:6px 10px; background:transparent;" value="${customTo}">
              <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <button class="btn btn-outline btn-sm" onclick="App._renderPhanTichTongContent('custom', document.getElementById('ptt-from').value, document.getElementById('ptt-to').value)">Lọc</button>
          </div>
        </div>

        <!-- HANG 1: DOANH SO GHI NHAN -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:24px;">
          <div class="trendy-stat-card trendy-stat-1">
            <div class="stat-label-trendy">Tổng doanh số toàn công ty</div>
            <div class="stat-num-trendy">${this._formatVND(dsGop)}</div>
          </div>
          <div class="trendy-stat-card trendy-stat-4">
            <div class="stat-label-trendy">Pixel — doanh số ghi nhận</div>
            <div class="stat-num-trendy">${this._formatVND(dsPixel)}</div>
          </div>
          <div class="trendy-stat-card trendy-stat-2">
            <div class="stat-label-trendy">Etsy — doanh số</div>
            <div class="stat-num-trendy">${this._formatVND(dsEtsy)}</div>
          </div>
        </div>

        <div style="font-size:13px; color:var(--clr-text-muted); line-height:1.6; background:var(--clr-card); border-radius:var(--radius-lg); padding:14px 18px; box-shadow:var(--shadow-sm);">
          <b>Doanh số ghi nhận</b> = giá trị đơn phát sinh trong kỳ (Pixel tính theo ngày lên đơn).
          <b>Tiền thực thu</b> = tiền thật sự về trong kỳ.
          Chênh lệch giữa hai hàng chính là phần khách còn nợ, hoặc tiền thu của đơn kỳ trước.
          Riêng Etsy hai con số bằng nhau vì khách trả ngay trên sàn.
          Biểu đồ và tỷ trọng bên dưới dựa trên <b>tiền thực thu</b>.
        </div>

        <!-- HANG 2: TIEN THUC THU -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:24px;">
          <div class="trendy-stat-card trendy-stat-1">
            <div class="stat-label-trendy">Tổng tiền thực thu toàn công ty</div>
            <div class="stat-num-trendy">${this._formatVND(tongGop)}</div>
          </div>
          <div class="trendy-stat-card trendy-stat-4">
            <div class="stat-label-trendy">Pixel — tiền thực thu</div>
            <div class="stat-num-trendy">${this._formatVND(tongPixel)}</div>
          </div>
          <div class="trendy-stat-card trendy-stat-2">
            <div class="stat-label-trendy">Etsy — doanh thu net</div>
            <div class="stat-num-trendy">${this._formatVND(tongEtsy)}</div>
          </div>
        </div>

        <!-- BIỂU ĐỒ -->
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; align-items:stretch;">
          <!-- Biểu đồ đường -->
          <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px; display:flex; flex-direction:column;">
            <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">Xu hướng Doanh thu (Gộp vs Từng nguồn)</h3>
            <div style="flex-grow:1; min-height:350px; position:relative;">
              <canvas id="ptt-chart-trend"></canvas>
            </div>
          </div>

          <!-- Nhóm biểu đồ nhỏ -->
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px; flex:1; display:flex; flex-direction:column;">
              <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600; text-align:center;">Tỷ trọng Nguồn thu</h3>
              <div style="flex-grow:1; min-height:200px; position:relative;">
                <canvas id="ptt-chart-pie"></canvas>
              </div>
            </div>
            
            <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px; flex:1; display:flex; flex-direction:column;">
              <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600; text-align:center;">So sánh trực quan</h3>
              <div style="flex-grow:1; min-height:200px; position:relative;">
                <canvas id="ptt-chart-bar"></canvas>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    setTimeout(() => this._initPhanTichTongCharts(dailyArr, tongPixel, tongEtsy), 100);
  },

  _initPhanTichTongCharts(dailyArr, tongPixel, tongEtsy) {
    if (!window.Chart) return;
    this._pttCharts = this._pttCharts || {};

    if (this._pttCharts.trend) this._pttCharts.trend.destroy();
    if (this._pttCharts.pie) this._pttCharts.pie.destroy();
    if (this._pttCharts.bar) this._pttCharts.bar.destroy();

    const canvasTrend = document.getElementById('ptt-chart-trend');
    const canvasPie = document.getElementById('ptt-chart-pie');
    const canvasBar = document.getElementById('ptt-chart-bar');

    // Hàm tạo gradient
    const makeGrad = (c, r, g, b, alpha = 0.35) => {
      if (!c.chart.chartArea) return `rgba(${r},${g},${b},${alpha})`;
      const ctx = c.chart.ctx;
      const area = c.chart.chartArea;
      const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
      gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      return gradient;
    };

    // Biểu đồ đường
    if (canvasTrend && dailyArr.length > 0) {
      const labels = dailyArr.map(r => r.date.substring(0, 5));
      const dataTotal = dailyArr.map(r => r.total);
      const dataPixel = dailyArr.map(r => r.pixel);
      const dataEtsy = dailyArr.map(r => r.etsy);

      this._pttCharts.trend = new Chart(canvasTrend, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Tổng gộp (VNĐ)',
              data: dataTotal,
              borderColor: '#8C7355',
              backgroundColor: (c) => makeGrad(c, 140, 115, 85),
              borderWidth: 2.5,
              borderDash: [6, 4],
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#8C7355',
            },
            {
              label: 'Pixel (VNĐ)',
              data: dataPixel,
              borderColor: '#B7A88F',
              backgroundColor: (c) => makeGrad(c, 183, 168, 143),
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#B7A88F',
            },
            {
              label: 'Etsy (VNĐ)',
              data: dataEtsy,
              borderColor: '#D8CBB8',
              backgroundColor: (c) => makeGrad(c, 216, 203, 184),
              borderWidth: 2.5,
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: '#D8CBB8',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#6B5E52', font: { size: 12 }, boxWidth: 12, padding: 14 } },
            tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + Number(c.raw).toLocaleString('vi-VN') + ' đ' } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#9E8E82', font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(100,80,60,0.03)', drawBorder: false }, ticks: { color: '#9E8E82', font: { size: 11 } } }
          }
        }
      });
    }

    // Biểu đồ tròn
    if (canvasPie && (tongPixel > 0 || tongEtsy > 0)) {
      this._pttCharts.pie = new Chart(canvasPie, {
        type: 'doughnut',
        data: {
          labels: ['Pixel', 'Etsy'],
          datasets: [{
            data: [tongPixel, tongEtsy],
            backgroundColor: ['#B7A88F', '#8C7355'],
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.85)',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#6B5E52', font: { size: 12 }, boxWidth: 12, padding: 14 } },
            tooltip: {
              callbacks: {
                label: (context) => context.label + ': ' + App._formatVND(context.raw)
              }
            }
          },
          cutout: '60%'
        }
      });
    }

    // Biểu đồ cột
    if (canvasBar && (tongPixel > 0 || tongEtsy > 0)) {
      this._pttCharts.bar = new Chart(canvasBar, {
        type: 'bar',
        data: {
          labels: ['Pixel', 'Etsy'],
          datasets: [{
            data: [tongPixel, tongEtsy],
            backgroundColor: ['#B7A88F', '#8C7355'],
            borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => App._formatVND(context.raw)
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#9E8E82', font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(100,80,60,0.03)', drawBorder: false }, ticks: { color: '#9E8E82', font: { size: 11 } } }
          }
        }
      });
    }
  },

  // ==========================================
  // TÀI CHÍNH TỔNG
  // ==========================================
  async renderTaiChinhTongPage() {
    const content = document.getElementById('page-content');
    content.style.padding = '24px';
    content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 0;flex-direction:column;gap:16px;">
      <div class="spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(138,114,76,0.2);border-top-color:var(--clr-accent);"></div>
      <p style="font-size:var(--font-size-sm);color:var(--clr-text-muted);">Đang tải dữ liệu Tài chính tổng hợp...</p>
    </div>`;

    try {
      const [manualRaw, etsyRaw, pixelRaw, donRaw] = await Promise.all([
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.TAI_CHINH_TONG).catch(e => {
          this._showToast(`Lỗi đọc Sổ quỹ: ${e.message}`, 'error'); return [];
        }),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DOANH_THU_KHAC).catch(e => {
          this._showToast(`Lỗi đọc Etsy: ${e.message}`, 'error'); return [];
        }),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.GIAO_DICH_TIEN, 'A:E').catch(e => {
          this._showToast(`Lỗi đọc Pixel: ${e.message}`, 'error'); return [];
        }),
        this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, '', CONFIG.OPERATION_SPREADSHEET_ID).catch(() => [])
      ]);

      // Chi lay giao dich cua don CON TON TAI (bo don da an/da xoa)
      const donHopLeTC = {};
      (donRaw || []).forEach(d => { if (d.ma_don && d.da_an !== 'yes') donHopLeTC[d.ma_don] = true; });
      
      // 1. Dữ liệu Manual
      this._taiChinhManualData = manualRaw.map((d, i) => {
        let pDate = new Date(0);
        if (d.ngay) {
          const [day, m, y] = d.ngay.split('/');
          if (day && m && y) pDate = new Date(y, m - 1, day);
        }
        return {
          ...d,
          _origIndex: i,
          parsedDate: pDate,
          so_tien: this._parseCurrency(d.so_tien) || 0
        };
      }).reverse(); // Mới nhất lên đầu

      // 2. Dữ liệu Auto (Etsy)
      let etsyRecords = etsyRaw.map(d => ({
        ...d,
        parsedDate: new Date(d.ngay || 0),
        so_tien: parseInt((d.so_tien || '').replace(/[^0-9-]/g, ''), 10) || 0
      }));
      etsyRecords.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
      
      const shopLastCumulative = {};
      for (const rec of etsyRecords) {
        const shop = rec.nguon;
        if (shopLastCumulative[shop] === undefined) {
          rec.doanh_thu_phat_sinh = rec.so_tien;
        } else {
          rec.doanh_thu_phat_sinh = rec.so_tien - shopLastCumulative[shop];
        }
        shopLastCumulative[shop] = rec.so_tien;
      }

      this._taiChinhAutoData = [];
      etsyRecords.forEach(r => {
        if (r.doanh_thu_phat_sinh) {
          this._taiChinhAutoData.push({
            ngay: r.ngay,
            nguon: `Etsy - ${r.nguon}`,
            so_tien: r.doanh_thu_phat_sinh,
            parsedDate: r.parsedDate
          });
        }
      });

      // 3. Dữ liệu Auto (Pixel)
      // DONG TIEN khac DOANH THU: giu tien tip (tien that su vao tai khoan)
      // va giu khoan am (hoan tra = tien di ra). Chi bo giao dich cua don da an.
      pixelRaw.forEach(r => {
        if (!donHopLeTC[r.ma_don]) return;
        let pDate = new Date(0);
        if (r.ngay) {
          const [day, m, y] = r.ngay.split('/');
          if (day && m && y) pDate = new Date(y, m - 1, day);
        }
        const tienPixel = this._parseCurrency(r.so_tien) || 0;
        if (tienPixel) {
          this._taiChinhAutoData.push({
            ngay: r.ngay,
            nguon: `Pixel`,
            so_tien: tienPixel,
            parsedDate: pDate
          });
        }
      });
      // Sắp xếp auto data mới nhất lên đầu
      this._taiChinhAutoData.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

      this._renderTaiChinhTongContent('all'); // Mặc định hiển thị tất cả
    } catch (e) {
      console.error(e);
      content.innerHTML = `<div style="color:var(--clr-error); padding:24px;">Lỗi tải dữ liệu: ${this._escHtml(e.message)}</div>`;
    }
  },

  _renderTaiChinhTongContent(filterType = 'all', filterLoai = 'all', customFrom = '', customTo = '') {
    const content = document.getElementById('page-content');
    const today = new Date();
    let startDate = new Date(0);
    let endDate = new Date('2999-12-31');

    if (filterType === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterType === 'last_month') {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    } else if (filterType === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filterType === 'custom') {
      startDate = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(0);
      endDate = customTo ? new Date(customTo + 'T23:59:59') : new Date('2999-12-31');
    }

    let tongThuTuDong = 0;
    const filteredAutoData = [];
    this._taiChinhAutoData.forEach(r => {
      if (r.parsedDate < startDate || r.parsedDate > endDate) return;
      tongThuTuDong += r.so_tien;
      filteredAutoData.push(r);
    });

    let tongThuThuCong = 0;
    let tongChiThuCong = 0;
    const filteredManualData = [];

    this._taiChinhManualData.forEach(r => {
      if (r.parsedDate < startDate || r.parsedDate > endDate) return;
      
      const loai = (r.loai || '').trim();
      if (filterLoai !== 'all' && loai !== filterLoai) return;

      if (loai === 'Thu') tongThuThuCong += r.so_tien;
      else if (loai === 'Chi') tongChiThuCong += r.so_tien;

      filteredManualData.push(r);
    });

    const tongThuTong = tongThuTuDong + tongThuThuCong;
    const soDu = tongThuTong - tongChiThuCong;   // chenh lech RIENG trong ky da loc

    // ── SO DU THUC TE TRONG TAI KHOAN ────────────────────────────
    // Khong phu thuoc bo loc ky: cong tat ca tu truoc toi nay.
    //   so du dau ky + moi khoan vao - moi khoan ra
    // "So du dau" la ban ghi trong TAI_CHINH_TONG co cot loai = "Số dư đầu".
    let soDuDau = 0;
    let coSoDuDau = false;
    let ngayChotSoDu = null;      // moc thoi gian cua ban ghi "So du dau"
    let thuTatCa = 0, chiTatCa = 0;
    const homNay = new Date(); homNay.setHours(23, 59, 59, 999);

    // B1: tim ban ghi "So du dau" (neu khai nhieu lan thi lay ban MOI NHAT)
    (this._taiChinhManualData || []).forEach(r => {
      if ((r.loai || '').trim() !== 'Số dư đầu') return;
      if (!ngayChotSoDu || r.parsedDate > ngayChotSoDu) {
        ngayChotSoDu = r.parsedDate;
        soDuDau = r.so_tien;
        coSoDuDau = true;
      }
    });

    // B2: ban ghi "So du dau" duoc hieu la SO DU CUOI NGAY do.
    // Nen chi cong cac khoan phat sinh TU NGAY HOM SAU tro di.
    // Neu cong ca lich su truoc do thi so du se bi doi len nhieu lan,
    // vi so du chot DA BAO GOM toan bo tien kiem duoc truoc do roi.
    let mocSoDu = null;
    if (ngayChotSoDu) {
      mocSoDu = new Date(ngayChotSoDu);
      mocSoDu.setHours(23, 59, 59, 999);   // het ngay chot
    }
    const trongPhamVi = (d) => d <= homNay && (!mocSoDu || d > mocSoDu);

    (this._taiChinhManualData || []).forEach(r => {
      const l = (r.loai || '').trim();
      if (l === 'Số dư đầu') return;
      if (!trongPhamVi(r.parsedDate)) return;
      if (l === 'Thu') thuTatCa += r.so_tien;
      else if (l === 'Chi') chiTatCa += r.so_tien;
    });
    (this._taiChinhAutoData || []).forEach(r => {
      if (!trongPhamVi(r.parsedDate)) return;
      thuTatCa += r.so_tien;
    });
    const soDuThucTe = soDuDau + thuTatCa - chiTatCa;
    const ngayChotStr = ngayChotSoDu
      ? `${String(ngayChotSoDu.getDate()).padStart(2,'0')}/${String(ngayChotSoDu.getMonth()+1).padStart(2,'0')}/${ngayChotSoDu.getFullYear()}`
      : '';

    const btnStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-border-light); background:var(--clr-surface); cursor:pointer; font-size:13px; font-weight:500; color:var(--clr-text); transition:all 0.2s;";
    const btnActiveStyle = "padding:6px 12px; border-radius:16px; border:1px solid var(--clr-accent); background:var(--clr-accent); color:#fff; cursor:pointer; font-size:13px; font-weight:500; transition:all 0.2s;";

    content.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; display:flex; flex-direction:column; gap:24px;">
        
        <!-- BỘ LỌC -->
        <div style="background:var(--clr-card); padding:20px; border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button style="${filterType === 'month' ? btnActiveStyle : btnStyle}" onclick="App._renderTaiChinhTongContent('month', document.getElementById('tct-filter-loai').value)">Tháng này</button>
            <button style="${filterType === 'last_month' ? btnActiveStyle : btnStyle}" onclick="App._renderTaiChinhTongContent('last_month', document.getElementById('tct-filter-loai').value)">Tháng trước</button>
            <button style="${filterType === 'year' ? btnActiveStyle : btnStyle}" onclick="App._renderTaiChinhTongContent('year', document.getElementById('tct-filter-loai').value)">Năm nay</button>
            <button style="${filterType === 'all' ? btnActiveStyle : btnStyle}" onclick="App._renderTaiChinhTongContent('all', document.getElementById('tct-filter-loai').value)">Tất cả</button>
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <select id="tct-filter-loai" class="form-select" style="width:120px;" onchange="App._renderTaiChinhTongContent('${filterType}', this.value, '${customFrom}', '${customTo}')">
              <option value="all" ${filterLoai === 'all' ? 'selected' : ''}>Tất cả loại (Sổ quỹ)</option>
              <option value="Thu" ${filterLoai === 'Thu' ? 'selected' : ''}>Chỉ Thu (Sổ quỹ)</option>
              <option value="Chi" ${filterLoai === 'Chi' ? 'selected' : ''}>Chỉ Chi (Sổ quỹ)</option>
            </select>
            <span style="font-size:14px; font-weight:500;">Từ:</span>
            <div class="custom-date-wrapper" style="width:140px;">
              <input type="date" onclick="this.showPicker()" id="tct-from" class="form-input custom-date-input" style="width:100%; padding:6px 10px; background:transparent;" value="${customFrom}">
              <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <span style="font-size:14px; font-weight:500;">Đến:</span>
            <div class="custom-date-wrapper" style="width:140px;">
              <input type="date" onclick="this.showPicker()" id="tct-to" class="form-input custom-date-input" style="width:100%; padding:6px 10px; background:transparent;" value="${customTo}">
              <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <button class="btn btn-outline btn-sm" onclick="App._renderTaiChinhTongContent('custom', document.getElementById('tct-filter-loai').value, document.getElementById('tct-from').value, document.getElementById('tct-to').value)">Lọc</button>
          </div>
        </div>

        <!-- CHỈ SỐ TỔNG -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:24px;">
          <div class="trendy-stat-card trendy-stat-1">
            <div class="stat-label-trendy">Thu tự động (Etsy+Pixel)</div>
            <div class="stat-num-trendy">${this._formatVND(tongThuTuDong)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
          <div class="trendy-stat-card trendy-stat-2">
            <div class="stat-label-trendy">Thu thủ công</div>
            <div class="stat-num-trendy">${this._formatVND(tongThuThuCong)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
          <div class="trendy-stat-card trendy-stat-3">
            <div class="stat-label-trendy">TỔNG THU</div>
            <div class="stat-num-trendy">${this._formatVND(tongThuTong)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
          <div class="trendy-stat-card trendy-stat-4">
            <div class="stat-label-trendy">TỔNG CHI</div>
            <div class="stat-num-trendy">${this._formatVND(tongChiThuCong)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
          <div class="trendy-stat-card trendy-stat-1">
            <div class="stat-label-trendy">CHÊNH LỆCH TRONG KỲ</div>
            <div class="stat-num-trendy" style="color: ${soDu < 0 ? 'var(--clr-danger)' : '#2A2420'} !important;">${this._formatVND(soDu)}</div>
            <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
          </div>
        </div>

        <!-- SO DU THUC TE TRONG TAI KHOAN -->
        <div style="background:${coSoDuDau ? 'linear-gradient(135deg,#3F3428,#5A4A38)' : 'var(--clr-card)'}; color:${coSoDuDau ? '#F5EFE6' : 'var(--clr-text)'}; border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px 24px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px;">
          <div>
            <div style="font-size:13px; opacity:0.85; font-weight:600; letter-spacing:0.5px;">SỐ DƯ HIỆN TẠI TRONG TÀI KHOẢN</div>
            <div style="font-size:28px; font-weight:800; margin-top:4px;">${this._formatVND(soDuThucTe)}</div>
            <div style="font-size:12px; opacity:0.8; margin-top:6px;">
              ${coSoDuDau
                ? `Chốt cuối ngày ${ngayChotStr}: ${this._formatVND(soDuDau)} + đã thu ${this._formatVND(thuTatCa)} − đã chi ${this._formatVND(chiTatCa)} (tính từ ngày kế tiếp trở đi)`
                : 'Chưa khai Số dư đầu — con số này chỉ là thu trừ chi, chưa phải số dư thật.'}
            </div>
          </div>
          ${coSoDuDau ? '' : `<div style="font-size:12px; max-width:340px; background:rgba(198,40,40,0.08); color:#C62828; border-radius:8px; padding:10px 12px; line-height:1.5;">
            Để con số này khớp tài khoản ngân hàng: thêm <b>một</b> khoản Loại = <b>Số dư đầu</b>, ngày là <b>ngày chốt sổ</b>, số tiền là <b>số dư cuối ngày hôm đó</b>. App chỉ cộng thu và trừ chi <b>từ ngày kế tiếp</b> trở đi.
          </div>`}
        </div>

        <!-- FORM NHẬP -->
        <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:24px;">
          <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">Nhập khoản Thu khác / Chi thủ công</h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; align-items:end;">
            <div>
              <label style="display:block; font-size:13px; font-weight:500; margin-bottom:6px;">Ngày ghi</label>
              <div class="custom-date-wrapper">
                <input type="date" onclick="this.showPicker()" id="tct-ngay" class="form-input custom-date-input" style="width:100%; background:transparent;" value="${this._formatDateInput(today)}">
                <svg class="custom-date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:500; margin-bottom:6px;">Loại</label>
              <select id="tct-loai" class="form-select" style="width:100%;">
                <option value="Thu">Thu</option>
                <option value="Chi">Chi</option>
                <option value="Số dư đầu">Số dư chốt sổ (số dư cuối ngày)</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:500; margin-bottom:6px;">Số tiền (VNĐ)</label>
              <input type="text" id="tct-sotien" class="form-input" style="width:100%;" placeholder="VD: 500,000" oninput="this.value = this.value.replace(/[^0-9]/g, '').replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')">
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:500; margin-bottom:6px;">Hạng mục</label>
              <input type="text" id="tct-hangmuc" class="form-input" style="width:100%;" placeholder="VD: Lương, Phần mềm...">
            </div>
          </div>
          <div style="display:flex; gap:16px; align-items:end; margin-top:16px;">
            <div style="flex-grow:1;">
              <label style="display:block; font-size:13px; font-weight:500; margin-bottom:6px;">Ghi chú (không bắt buộc)</label>
              <input type="text" id="tct-ghichu" class="form-input" style="width:100%;" placeholder="Ghi chú thêm...">
            </div>
            <button class="btn btn-primary" id="tct-btn-save" onclick="App._saveTaiChinhTongRecord()" style="min-width:120px;">Lưu khoản</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:32px;">
          <!-- BẢNG TỰ ĐỘNG -->
          <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden;">
            <div style="padding:16px 20px; background:rgba(142, 68, 173, 0.05); border-bottom:1px solid var(--clr-border-light);">
              <h3 style="margin:0; font-size:15px; font-weight:600; color:#8E44AD;">Doanh thu Tự động (Etsy + Pixel)</h3>
            </div>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead>
                  <tr style="background:rgba(0,0,0,0.02); color:var(--clr-text-muted); font-size:13px; text-transform:uppercase; letter-spacing:0.05em; text-align:left;">
                    <th style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">Ngày</th>
                    <th style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">Nguồn</th>
                    <th style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light); text-align:right;">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredAutoData.length > 0 ? filteredAutoData.map(r => `
                    <tr class="table-row-hover">
                      <td style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">${this._escHtml(r.ngay)}</td>
                      <td style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light); font-weight:500;">${this._escHtml(r.nguon)}</td>
                      <td style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light); text-align:right; font-weight:600; color:#8E44AD;">${this._formatVND(r.so_tien)}</td>
                    </tr>
                  `).join('') : `<tr><td colspan="3" style="padding:24px; text-align:center; color:var(--clr-text-muted);">Không có doanh thu tự động trong kỳ</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <!-- BẢNG THỦ CÔNG -->
          <div style="background:var(--clr-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden;">
            <div style="padding:16px 20px; background:rgba(41, 128, 185, 0.05); border-bottom:1px solid var(--clr-border-light);">
              <h3 style="margin:0; font-size:15px; font-weight:600; color:#2980B9;">Thu / Chi Thủ công (Sổ quỹ)</h3>
            </div>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead>
                  <tr style="background:rgba(0,0,0,0.02); color:var(--clr-text-muted); font-size:13px; text-transform:uppercase; letter-spacing:0.05em; text-align:left;">
                    <th style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">Ngày</th>
                    <th style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light); width:80px;">Loại</th>
                    <th style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light); text-align:right;">Số tiền</th>
                    <th style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">Hạng mục</th>
                    <th style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredManualData.length > 0 ? filteredManualData.map(r => `
                    <tr class="table-row-hover">
                      <td style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">${this._escHtml(r.ngay)}</td>
                      <td style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">
                        <span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600; background:${r.loai === 'Thu' ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)'}; color:${r.loai === 'Thu' ? '#27AE60' : '#E74C3C'};">${this._escHtml(r.loai)}</span>
                      </td>
                      <td style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light); text-align:right; font-weight:600; color:${r.loai === 'Thu' ? '#27AE60' : '#E74C3C'};">${this._formatVND(r.so_tien)}</td>
                      <td style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light);">${this._escHtml(r.hang_muc)}</td>
                      <td style="padding:12px 20px; border-bottom:1px solid var(--clr-border-light); color:var(--clr-text-muted);">${this._escHtml(r.ghi_chu)}</td>
                    </tr>
                  `).join('') : `<tr><td colspan="5" style="padding:24px; text-align:center; color:var(--clr-text-muted);">Không có giao dịch thủ công nào trong kỳ</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  async _saveTaiChinhTongRecord() {
    const ngayInput = document.getElementById('tct-ngay').value;
    const loai = document.getElementById('tct-loai').value;
    const soTienRaw = document.getElementById('tct-sotien').value;
    const hangMuc = (document.getElementById('tct-hangmuc').value || '').trim();
    const ghiChu = (document.getElementById('tct-ghichu').value || '').trim();

    if (!ngayInput || !loai || !soTienRaw || !hangMuc) {
      this._showToast('Vui lòng nhập đủ Ngày, Loại, Số tiền và Hạng mục.', 'error');
      return;
    }

    const soTien = parseInt(soTienRaw.replace(/[^0-9]/g, ''), 10);
    if (isNaN(soTien) || soTien <= 0) {
      this._showToast('Số tiền không hợp lệ.', 'error');
      return;
    }

    // Format ngày thành DD/MM/YYYY
    const [y, m, d] = ngayInput.split('-');
    const ngay = `${d}/${m}/${y}`;

    const btn = document.getElementById('tct-btn-save');
    const oldText = btn.innerHTML;
    btn.innerHTML = 'Đang lưu...';
    btn.disabled = true;

    try {
      // 5 cột theo thứ tự: ngay, loai, so_tien, hang_muc, ghi_chu
      const row = [ngay, loai, soTien, hangMuc, ghiChu];
      await this._appendRow(this.session.accessToken, CONFIG.SHEETS.TAI_CHINH_TONG, row);
      
      this._showToast('Đã lưu khoản thành công!', 'success');
      this.renderTaiChinhTongPage(); // Tải lại trang để update số liệu
    } catch (e) {
      console.error(e);
      this._showToast(`Lỗi khi lưu: ${e.message}`, 'error');
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  },

  async renderHieuSuatNhanSuPage() {
    const content = document.getElementById('page-content');
    const now = new Date();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curYear = now.getFullYear();
    const defaultMonthYear = `${curYear}-${curMonth}`;

    content.innerHTML = `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
        <h1 style="margin:0; font-size: 24px; color: var(--clr-text);">Chi lương & Hiệu suất</h1>
        <div style="display:flex; gap:12px; align-items:center;">
          <input type="month" id="hs-month-picker" class="form-input" style="width: auto; padding: 6px 12px;" value="${defaultMonthYear}" />
          <button class="btn btn-primary" onclick="App.loadHieuSuatNhanSu()" style="padding: 6px 16px;">Xem</button>
        </div>
      </div>
      
      <div id="hs-loading" style="text-align:center; padding:40px; display:none;">
        <span class="spinner" style="width:24px; height:24px; border-width:3px; border-color:var(--clr-accent) transparent transparent transparent;"></span>
        <div style="margin-top:12px; color:var(--clr-text-muted);">Đang tính toán dữ liệu...</div>
      </div>
      
      <div id="hs-error" style="display:none; padding:16px; background:#FADBD8; color:#C0392B; border-radius:8px; margin-bottom:20px;"></div>
      
      <div id="hs-content" style="display:none;">
        <!-- Tổng quan -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:24px; margin-bottom:24px;">
           <div class="trendy-stat-card trendy-stat-1">
              <div class="stat-label-trendy">Tổng chi lương tháng</div>
              <div id="hs-tong-luong" class="stat-num-trendy">0đ</div>
              <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
           </div>
           <div class="trendy-stat-card trendy-stat-2">
              <div class="stat-label-trendy">Tổng doanh thu tháng</div>
              <div id="hs-tong-doanh-thu" class="stat-num-trendy">0đ</div>
              <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
           </div>
           <div class="trendy-stat-card trendy-stat-3">
              <div class="stat-label-trendy">Tỷ lệ Chi / Thu</div>
              <div id="hs-ty-le" class="stat-num-trendy">0%</div>
              <div class="stat-icon-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></div>
           </div>
        </div>
        
        <!-- Biểu đồ -->
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:24px; margin-bottom:24px;">
           <div style="background:var(--clr-card); padding:20px; border-radius:12px; box-shadow:var(--shadow-sm); border:1px solid var(--clr-border); max-height:400px; overflow-y:auto;">
              <h3 style="margin:0 0 16px 0; font-size:16px; color:var(--clr-text);">Hiệu suất nhân sự</h3>
              <div id="hs-table-container"></div>
           </div>
           <div style="background:var(--clr-card); padding:20px; border-radius:12px; box-shadow:var(--shadow-sm); border:1px solid var(--clr-border);">
              <h3 style="margin:0 0 16px 0; font-size:16px; color:var(--clr-text);">Tỷ trọng chi lương</h3>
              <div id="hs-pie-container"></div>
              <div id="hs-insight-text" style="text-align:center; font-style:italic; color:var(--clr-text-muted); margin-top:12px; font-size:13px;"></div>
           </div>
        </div>
      </div>
    `;

    await this.loadHieuSuatNhanSu();
  },

  async loadHieuSuatNhanSu() {
     const loading = document.getElementById('hs-loading');
     const cont = document.getElementById('hs-content');
     const errCont = document.getElementById('hs-error');
     const picker = document.getElementById('hs-month-picker');

     if (!picker || !loading) return;

     loading.style.display = 'block';
     cont.style.display = 'none';
     errCont.style.display = 'none';

     try {
        const [yearStr, monthStr] = picker.value.split('-');
        const targetMonthYear = `${monthStr}/${yearStr}`;
        const targetMonthYear2 = `${monthStr}-${yearStr}`;

        const tYear = parseInt(yearStr);
        const tMonth = parseInt(monthStr);

        const isTargetMonth = (dateStr) => {
            if (!dateStr) return false;
            const parts = dateStr.split('/');
            if (parts.length >= 2) {
                const m = parseInt(parts[1]);
                const y = parts.length === 3 ? parseInt(parts[2]) : tYear;
                return m === tMonth && y === tYear;
            }
            return false;
        };

        // Tải cấu hình lương
        const cauHinhRows = await this._readSheet(this.session.accessToken, CONFIG.SHEETS.CAU_HINH_LUONG, '', CONFIG.PAYROLL_SPREADSHEET_ID).catch(() => []);
        
        // Tải tài chính
        const [giaoDichRows, tienDonRows, donHangRows, diemDesignerRows] = await Promise.all([
           this._readSheet(this.session.accessToken, CONFIG.SHEETS.GIAO_DICH_TIEN, '', CONFIG.FINANCE_SPREADSHEET_ID).catch(()=>[]),
           this._readSheet(this.session.accessToken, CONFIG.SHEETS.TIEN_DON, '', CONFIG.FINANCE_SPREADSHEET_ID).catch(()=>[]),
           this._readSheet(this.session.accessToken, CONFIG.SHEETS.DON_HANG, '', CONFIG.OPERATION_SPREADSHEET_ID).catch(()=>[]),
           this._readSheet(this.session.accessToken, CONFIG.SHEETS.DIEM_DESIGNER, '', CONFIG.OPERATION_SPREADSHEET_ID).catch(()=>[])
        ]);

        // Chi lay don CON TON TAI (bo don da an) - dung chuan voi cac man khac
        const donHopLeHS = {};
        donHangRows.forEach(d => { if (d.ma_don && d.da_an !== 'yes') donHopLeHS[d.ma_don] = true; });

        // Doanh thu thang: tien thuc thu, BO tip va BO giao dich cua don da an.
        // (Cung chuan voi man Phan tich tong, de hai man khong bao hai con so khac nhau)
        let tongDoanhThu = 0;
        giaoDichRows.forEach(gd => {
           if (!donHopLeHS[gd.ma_don]) return;
           const isTip = gd.loai && gd.loai.toLowerCase() === 'tip';
           if (isTip) return;
           if (isTargetMonth((gd.ngay || '').trim())) {
              const tien = this._parseCurrency(gd.so_tien);
              if (tien > 0) tongDoanhThu += tien;
           }
        });

        const tienDonMap = {};
        tienDonRows.forEach(r => { if(r.ma_don) tienDonMap[r.ma_don] = this._parseCurrency(r.tong_gia_tri); });

        const donHangMap = {};
        donHangRows.forEach(d => {
           donHangMap[d.ma_don] = d;
        });

        let tongChiLuong = 0;
        const nvStats = [];

        // Lọc nhân viên
        const nvList = cauHinhRows.filter(r => r.ho_ten && r.file_ca_nhan_id && ['sale', 'designer_hieu_suat'].includes((r.loai_luong || '').trim().toLowerCase()));

        for (const nv of nvList) {
           const hoTen = nv.ho_ten.trim();
           const loai = (nv.loai_luong || '').trim().toLowerCase();
           const fileId = nv.file_ca_nhan_id.trim();
           
           // Fetch salary
           const luongRows = await this._readSheet(this.session.accessToken, 'LUONG', '', fileId).catch(() => []);
           const myRow = luongRows.find(r => {
               const t = (r.thang || '').trim();
               if (!t) return false;
               const p = t.replace('-', '/').split('/');
               if (p.length === 2) return parseInt(p[0]) === tMonth && parseInt(p[1]) === tYear;
               if (p.length === 3) return parseInt(p[1]) === tMonth && parseInt(p[2]) === tYear;
               return t === targetMonthYear || t === targetMonthYear2;
           });
           
           const luongThang = myRow ? (parseFloat(myRow.tong_luong) || 0) : 0;
           tongChiLuong += luongThang;

           // Calculate value
           let giaTriMangLai = 0;
           if (loai === 'sale') {
              const saleOrders = donHangRows.filter(d => {
                 if (d.da_an === 'yes') return false;
                 if ((d.sale_phu_trach || '').trim().toLowerCase() !== hoTen.toLowerCase()) return false;
                 const tt = (d.trang_thai || '').toLowerCase();
                 if (tt.includes('hủy') || tt.includes('huy')) return false;
                 const ngayThuDu = (d.ngay_thu_du || '').trim();
                 return isTargetMonth(ngayThuDu);
              });
              giaTriMangLai = saleOrders.reduce((sum, d) => sum + (tienDonMap[d.ma_don] || 0), 0);
           } else if (loai === 'designer_hieu_suat') {
              const myDiem = diemDesignerRows.filter(d => {
                 if ((d.ten_designer || '').trim().toLowerCase() !== hoTen.toLowerCase()) return false;
                 const don = donHangMap[d.ma_don];
                 if (!don) return false;
                 const ngayDuyet = (don.ngay_duyet_mau || '').trim();
                 return isTargetMonth(ngayDuyet);
              });
              const tongDiem = myDiem.reduce((sum, d) => sum + parseFloat(d.diem || 0), 0);
              const donGia = this._parseCurrency(nv.don_gia_diem) || 500000;
              giaTriMangLai = tongDiem * donGia;
           }

           nvStats.push({ hoTen, loai, luongThang, giaTriMangLai });
        }

        // Update UI summary
        document.getElementById('hs-tong-luong').textContent = this._formatVND(tongChiLuong);
        document.getElementById('hs-tong-doanh-thu').textContent = this._formatVND(tongDoanhThu);
        const pt = tongDoanhThu > 0 ? (tongChiLuong / tongDoanhThu * 100) : 0;
        const colorPt = pt > 40 ? '#9C7E5E' : (pt > 25 ? '#E8B86D' : '#B5CDA3');
        const tyLeEl = document.getElementById('hs-ty-le');
        tyLeEl.textContent = pt.toFixed(1) + '%';
        tyLeEl.style.color = colorPt;
        
        const insightEl = document.getElementById('hs-insight-text');
        if (insightEl) {
           insightEl.textContent = `Nhận định: Chi lương chiếm ${pt.toFixed(1)}% doanh thu tháng này.`;
        }

        // Render Table
        const tableContainer = document.getElementById('hs-table-container');
        if (tableContainer) {
            let html = `<table style="width:100%; border-collapse:collapse; font-size:14px; text-align:left;">
                <thead>
                    <tr style="border-bottom:1px solid var(--clr-border); color:var(--clr-text-muted);">
                        <th style="padding:10px 8px; font-weight:500;">Nhân viên</th>
                        <th style="padding:10px 8px; font-weight:500; text-align:right;">Lương thực nhận</th>
                        <th style="padding:10px 8px; font-weight:500; text-align:right;">Giá trị mang lại</th>
                        <th style="padding:10px 8px; font-weight:500; text-align:center;">Hiệu suất</th>
                    </tr>
                </thead>
                <tbody>`;
            
            nvStats.forEach(nv => {
                const roleText = nv.loai === 'sale' ? 'Sale' : 'Designer';
                const luongStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(nv.luongThang);
                const giaTriStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(nv.giaTriMangLai);
                
                let effPct = 0;
                let effText = 'Chưa có G.Trị';
                let effColor = '#7f8c8d';
                let barColor = '#bdc3c7';
                
                if (nv.giaTriMangLai > 0) {
                    effPct = (nv.luongThang / nv.giaTriMangLai) * 100;
                    if (effPct >= 100) {
                        effText = effPct.toFixed(1) + '% (Cần xem lại)';
                        effColor = '#9C7E5E';
                        barColor = '#9C7E5E';
                    } else {
                        effText = effPct.toFixed(1) + '% (Hiệu quả)';
                        effColor = '#B5CDA3';
                        barColor = '#B5CDA3';
                    }
                }

                // Giới hạn chiều dài thanh progress bar hiển thị tối đa 100%
                const barWidth = Math.min(effPct, 100);

                html += `<tr style="border-bottom:1px solid var(--clr-border-light);">
                    <td style="padding:12px 8px;">
                        <div style="font-weight:600; color:var(--clr-text);">${this._escHtml(nv.hoTen)}</div>
                        <div style="font-size:12px; color:var(--clr-text-muted);">${roleText}</div>
                    </td>
                    <td style="padding:12px 8px; text-align:right; font-weight:500;">${luongStr}</td>
                    <td style="padding:12px 8px; text-align:right; font-weight:500;">${giaTriStr}</td>
                    <td style="padding:12px 8px;">
                        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
                            <span style="color:${effColor}; font-weight:600; font-size:13px;">${effText}</span>
                            <div style="width:100px; height:6px; background:var(--clr-border-light); border-radius:3px; overflow:hidden;">
                                <div style="width:${barWidth}%; height:100%; background:${barColor};"></div>
                            </div>
                        </div>
                    </td>
                </tr>`;
            });
            
            html += `</tbody></table>`;
            tableContainer.innerHTML = html;
        }

        // Render CSS Pie Chart (thay Chart.js dạng pie để tránh lỗi canvas)
        const pieContainer = document.getElementById('hs-pie-container');
        if (pieContainer) {
            const total = tongChiLuong + Math.max(0, tongDoanhThu - tongChiLuong);
            const luongPct = total > 0 ? (tongChiLuong / total * 100) : 0;
            const remainPct = 100 - luongPct;
            const remainVal = Math.max(0, tongDoanhThu - tongChiLuong);
            const luongStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tongChiLuong);
            const remainStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(remainVal);

            // SVG pie chart - luôn hiển thị
            const rad = luongPct / 100 * 2 * Math.PI;
            const x1 = Math.cos(rad - Math.PI / 2);
            const y1 = Math.sin(rad - Math.PI / 2);
            const largeArc = luongPct > 50 ? 1 : 0;
            const svgPie = luongPct >= 100
                ? `<circle cx="60" cy="60" r="55" fill="#8C7355"/>`
                : luongPct <= 0
                ? `<circle cx="60" cy="60" r="55" fill="#D8CBB8"/>`
                : `<circle cx="60" cy="60" r="55" fill="#D8CBB8"/>
                   <path d="M60,60 L60,5 A55,55 0 ${largeArc},1 ${60 + 55 * x1},${60 + 55 * y1} Z" fill="#8C7355"/>`;

            pieContainer.innerHTML = `
                <div style="display:flex; align-items:center; gap:24px; flex-wrap:wrap; justify-content:center;">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                        ${svgPie}
                        <circle cx="60" cy="60" r="32" fill="var(--clr-card)"/>
                        <text x="60" y="56" text-anchor="middle" font-size="13" font-weight="700" fill="var(--clr-text)">${luongPct.toFixed(1)}%</text>
                        <text x="60" y="72" text-anchor="middle" font-size="9" fill="var(--clr-text-muted)">Chi lương</text>
                    </svg>
                    <div style="display:flex; flex-direction:column; gap:12px; flex:1; min-width:140px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                <div style="width:12px;height:12px;border-radius:50%;background:#8C7355;flex-shrink:0;"></div>
                                <span style="font-size:13px; font-weight:600; color:var(--clr-text);">Chi lương</span>
                                <span style="margin-left:auto; font-size:13px; font-weight:700; color:#8C7355;">${luongPct.toFixed(1)}%</span>
                            </div>
                            <div style="font-size:12px; color:var(--clr-text-muted); padding-left:20px;">${luongStr}</div>
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                <div style="width:12px;height:12px;border-radius:50%;background:#D8CBB8;flex-shrink:0;"></div>
                                <span style="font-size:13px; font-weight:600; color:var(--clr-text);">Doanh thu còn lại</span>
                                <span style="margin-left:auto; font-size:13px; font-weight:700; color:#D8CBB8;">${remainPct.toFixed(1)}%</span>
                            </div>
                            <div style="font-size:12px; color:var(--clr-text-muted); padding-left:20px;">${remainStr}</div>
                        </div>
                        <div style="margin-top:4px; height:8px; border-radius:4px; overflow:hidden; background:#D8CBB8;">
                            <div style="height:100%; background:#8C7355; width:${luongPct.toFixed(1)}%;"></div>
                        </div>
                    </div>
                </div>`;
        }

        cont.style.display = 'block';
     } catch (err) {
        console.error('[Hiệu Suất] Lỗi:', err);
        errCont.textContent = 'Lỗi tải dữ liệu: ' + err.message;
        errCont.style.display = 'block';
     } finally {
        loading.style.display = 'none';
     }
  }

};



// ──────────────────────────────────────────────────────────
// BOOTSTRAP — Chờ DOM + GSI script cùng sẵn sàng
// ──────────────────────────────────────────────────────────
(function bootstrap() {
  let domReady = false;
  let gsiReady = false;

  function tryInit() {
    if (domReady && gsiReady) { App.init(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { domReady = true; tryInit(); });
  } else {
    domReady = true;
  }

  function waitForGSI() {
    if (typeof google !== 'undefined' && google?.accounts?.oauth2) { gsiReady = true; tryInit(); }
    else { setTimeout(waitForGSI, 150); }
  }
  waitForGSI();
})();


// ============================================================
// HÀM RIÊNG BIỆT: taoThongBaoChat
// ============================================================
// Tạo nội dung thông báo để gửi lên Google Chat.
// Tách riêng để dễ nâng cấp gửi tự động sau này.
//
// @param {string} ma_don   - Mã đơn hàng (VD: DON-0001)
// @param {string} link_the - Link tới thẻ Kanban của đơn
// @returns {string}        - Chuỗi thông báo sẵn sàng gửi lên Chat
// ============================================================
function taoThongBaoChat(ma_don, link_the) {
  return `📋 Đơn mới: ${ma_don} — ${link_the}`;
}

