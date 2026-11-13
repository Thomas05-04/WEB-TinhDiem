/**
 * GradebookDB - Module lưu trữ bền vững sử dụng IndexedDB
 * Giúp lưu trữ vĩnh viễn bảng điểm và mẫu môn học ngay trên trình duyệt máy tính,
 * không bị mất khi đóng trình duyệt hay xóa cache thông thường.
 * Hoạt động tốt cả khi mở trực tiếp file:// lẫn chạy qua web server/GitHub Pages.
 */
(function(window) {
  'use strict';

  const DB_NAME = 'CLOGradebook_Database';
  const DB_VERSION = 1;
  const STORE_GRADEBOOKS = 'gradebooks';
  const STORE_PRESETS = 'presets';

  let dbInstance = null;

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Bảng lưu trữ các bảng điểm đã tính
        if (!db.objectStoreNames.contains(STORE_GRADEBOOKS)) {
          const gbStore = db.createObjectStore(STORE_GRADEBOOKS, { keyPath: 'id' });
          gbStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          gbStore.createIndex('courseName', 'courseName', { unique: false });
          gbStore.createIndex('title', 'title', { unique: false });
        }

        // Bảng lưu trữ các mẫu môn học (trọng số, rubric mặc định)
        if (!db.objectStoreNames.contains(STORE_PRESETS)) {
          const presetStore = db.createObjectStore(STORE_PRESETS, { keyPath: 'id' });
          presetStore.createIndex('courseName', 'courseName', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.error('Không thể mở IndexedDB:', event.target.error);
        reject(new Error('Lỗi mở cơ sở dữ liệu: ' + event.target.error?.message));
      };
    });
  }

  // Tiện ích thực hiện Transaction
  function withStore(storeName, mode, callback) {
    return openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result = null;

        tx.oncomplete = () => resolve(result);
        tx.onerror = (e) => reject(e.target.error);
        tx.onabort = (e) => reject(e.target.error);

        result = callback(store);
      });
    });
  }

  const GradebookDB = {
    /**
     * Khởi tạo cơ sở dữ liệu
     */
    init: function() {
      return openDB();
    },

    // ==========================================
    // 1. QUẢN LÝ BẢNG ĐIỂM (GRADEBOOKS)
    // ==========================================

    /**
     * Lưu hoặc cập nhật một bảng điểm
     * @param {Object} gradebook
     */
    saveGradebook: function(gradebook) {
      if (!gradebook.id) {
        gradebook.id = 'gb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      }
      const now = new Date().toISOString();
      if (!gradebook.createdAt) gradebook.createdAt = now;
      gradebook.updatedAt = now;

      return withStore(STORE_GRADEBOOKS, 'readwrite', (store) => {
        store.put(gradebook);
        return gradebook;
      });
    },

    /**
     * Lấy tất cả bảng điểm đã lưu (sắp xếp mới nhất lên đầu)
     */
    getAllGradebooks: function() {
      return withStore(STORE_GRADEBOOKS, 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            // Sắp xếp theo ngày cập nhật mới nhất
            list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            resolve(list);
          };
          req.onerror = () => reject(req.error);
        });
      });
    },

    /**
     * Lấy chi tiết một bảng điểm theo ID
     * @param {string} id
     */
    getGradebook: function(id) {
      return withStore(STORE_GRADEBOOKS, 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      });
    },

    /**
     * Xóa một bảng điểm
     * @param {string} id
     */
    deleteGradebook: function(id) {
      return withStore(STORE_GRADEBOOKS, 'readwrite', (store) => {
        store.delete(id);
      });
    },

    // ==========================================
    // 2. QUẢN LÝ MẪU MÔN HỌC (COURSE PRESETS)
    // ==========================================

    /**
     * Lưu mẫu môn học (trọng số, rubric...)
     * @param {Object} preset
     */
    savePreset: function(preset) {
      if (!preset.id) {
        preset.id = 'pre_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      }
      preset.updatedAt = new Date().toISOString();

      return withStore(STORE_PRESETS, 'readwrite', (store) => {
        store.put(preset);
        return preset;
      });
    },

    /**
     * Lấy tất cả các mẫu môn học
     */
    getAllPresets: function() {
      return withStore(STORE_PRESETS, 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      });
    },

    /**
     * Xóa một mẫu môn học
     * @param {string} id
     */
    deletePreset: function(id) {
      return withStore(STORE_PRESETS, 'readwrite', (store) => {
        store.delete(id);
      });
    },

    // ==========================================
    // 3. SAO LƯU & KHÔI PHỤC TOÀN BỘ (BACKUP / RESTORE)
    // ==========================================

    /**
     * Xuất toàn bộ dữ liệu trong Database ra chuỗi JSON để tải về máy dự phòng
     */
    exportBackup: async function() {
      const gradebooks = await this.getAllGradebooks();
      const presets = await this.getAllPresets();
      return JSON.stringify({
        app: 'CLOGradebook',
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        gradebooks,
        presets
      }, null, 2);
    },

    /**
     * Khôi phục cơ sở dữ liệu từ file JSON sao lưu
     * @param {string|Object} jsonInput
     */
    importBackup: async function(jsonInput) {
      const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      if (!data || !Array.isArray(data.gradebooks)) {
        throw new Error('Dữ liệu sao lưu không đúng định dạng!');
      }

      for (const gb of data.gradebooks) {
        await this.saveGradebook(gb);
      }
      if (Array.isArray(data.presets)) {
        for (const p of data.presets) {
          await this.savePreset(p);
        }
      }
      return {
        gradebooksCount: data.gradebooks.length,
        presetsCount: (data.presets || []).length
      };
    },

    /**
     * Tự động di chuyển dữ liệu cũ từ localStorage sang IndexedDB nếu có
     */
    migrateFromLocalStorage: async function(oldKey = 'clo_gradebook_demo_2026_v1') {
      try {
        const oldRaw = localStorage.getItem(oldKey);
        if (!oldRaw) return false;

        const oldData = JSON.parse(oldRaw);
        if (!oldData || !Array.isArray(oldData.students) || oldData.students.length === 0) return false;

        const existing = await this.getAllGradebooks();
        // Nếu đã có dữ liệu trong IndexedDB thì không di chuyển nữa để tránh trùng
        if (existing.length > 0) return false;

        // Chuyển dữ liệu cũ thành 1 bảng điểm trong DB mới
        const migratedGradebook = {
          id: 'gb_legacy_imported',
          title: oldData.course || 'Bảng điểm mẫu (Chuyển đổi từ dữ liệu cũ)',
          courseName: oldData.course || 'Quản trị kênh phân phối (312121)',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          studentCount: oldData.students.length,
          weights: oldData.weights,
          criteria: oldData.criteria,
          cap: oldData.cap,
          bonusUnit: oldData.bonusUnit,
          bonusCap: oldData.bonusCap,
          sessionsDone: oldData.sessionsDone,
          students: oldData.students,
          groupScores: oldData.groupScores || {},
          notes: 'Tự động sao lưu từ dữ liệu cũ trên trình duyệt.'
        };

        await this.saveGradebook(migratedGradebook);
        console.log('Đã tự động chuyển dữ liệu cũ từ localStorage sang IndexedDB an toàn.');
        return true;
      } catch (err) {
        console.warn('Không thể chuyển đổi dữ liệu localStorage:', err);
        return false;
      }
    }
  };

  window.GradebookDB = GradebookDB;
})(window);

