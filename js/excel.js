/**
 * ExcelParser - Module đọc, nhận diện và xuất dữ liệu bảng điểm từ Excel/CSV
 * Sử dụng thư viện SheetJS (xlsx.full.min.js) chạy offline 100%
 */
(function(window) {
  'use strict';

  // Danh mục từ khóa nhận diện cột thông minh (không phân biệt hoa thường, không dấu)
  const KEYWORDS = {
    id: ['masv', 'mssv', 'masinhvien', 'mahocsinh', 'student id', 'studentid', 'id', 'ma'],
    lastName: ['holot', 'hovatendiem', 'hodem', 'ho', 'last name', 'lastname'],
    firstName: ['ten', 'first name', 'firstname'],
    fullName: ['hoten', 'hovaten', 'hotensinhvien', 'full name', 'fullname', 'tensinhvien'],
    group: ['nhom', 'to', 'lop', 'group', 'class', 'team', 'lopkhoahoc'],
    activity: ['thamgia', 'chuyencan', 'cc', 'diemchuyencan', 'phatbieu', 'hoatdong', 'activity', 'attendance'],
    mid: ['giuaky', 'giuaki', 'gk', 'midterm', 'mid-term', 'ktgk', 'diemgiuaky'],
    bonuses: ['luotcong', 'diemcong', 'cong', 'thuong', 'bonus', 'bonuses']
  };

  function normalizeStr(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function matchKeyword(headerText, keywordList) {
    const norm = normalizeStr(headerText);
    if (!norm) return false;
    for (const kw of keywordList) {
      const normKw = normalizeStr(kw);
      if (norm === normKw || norm.includes(normKw)) return true;
    }
    return false;
  }

  const ExcelParser = {
    /**
     * Đọc file ArrayBuffer từ input[type=file]
     * @param {File} file
     * @returns {Promise<Object>}
     */
    parseFile: function(file) {
      return new Promise((resolve, reject) => {
        if (!window.XLSX) {
          reject(new Error('Thư viện đọc Excel chưa sẵn sàng. Hãy kiểm tra file js/xlsx.full.min.js!'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            
            // Lấy sheet đầu tiên
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Chuyển sang dạng ma trận mảng 2 chiều
            const rawRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (!rawRows || rawRows.length === 0) {
              throw new Error('File Excel rỗng, không tìm thấy dữ liệu.');
            }

            // 1. Tìm dòng tiêu đề (Header row) thông minh trong 15 dòng đầu
            let headerRowIndex = 0;
            let bestScore = -1;

            for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
              const row = rawRows[r];
              if (!Array.isArray(row)) continue;
              
              let score = 0;
              row.forEach(cell => {
                const text = String(cell || '');
                if (matchKeyword(text, KEYWORDS.id)) score += 3;
                if (matchKeyword(text, KEYWORDS.fullName) || matchKeyword(text, KEYWORDS.firstName)) score += 3;
                if (matchKeyword(text, KEYWORDS.mid)) score += 2;
                if (matchKeyword(text, KEYWORDS.activity)) score += 2;
              });

              if (score > bestScore) {
                bestScore = score;
                headerRowIndex = r;
              }
            }

            const headerRow = rawRows[headerRowIndex].map(h => String(h || '').trim());
            const dataRows = rawRows.slice(headerRowIndex + 1).filter(row => {
              // Lọc bỏ dòng trống hoàn toàn
              return row && row.some(cell => String(cell).trim() !== '');
            });

            // 2. Tự động nhận diện cột (Smart Mapping)
            const detectedMapping = {
              idCol: -1,
              nameCol: -1,
              lastNameCol: -1,
              firstNameCol: -1,
              groupCol: -1,
              activityCol: -1,
              midCol: -1,
              bonusesCol: -1
            };

            headerRow.forEach((colName, idx) => {
              if (!colName) return;
              if (detectedMapping.idCol === -1 && matchKeyword(colName, KEYWORDS.id)) detectedMapping.idCol = idx;
              if (detectedMapping.nameCol === -1 && matchKeyword(colName, KEYWORDS.fullName)) detectedMapping.nameCol = idx;
              if (detectedMapping.lastNameCol === -1 && matchKeyword(colName, KEYWORDS.lastName)) detectedMapping.lastNameCol = idx;
              if (detectedMapping.firstNameCol === -1 && matchKeyword(colName, KEYWORDS.firstName)) detectedMapping.firstNameCol = idx;
              if (detectedMapping.groupCol === -1 && matchKeyword(colName, KEYWORDS.group)) detectedMapping.groupCol = idx;
              if (detectedMapping.activityCol === -1 && matchKeyword(colName, KEYWORDS.activity)) detectedMapping.activityCol = idx;
              if (detectedMapping.midCol === -1 && matchKeyword(colName, KEYWORDS.mid)) detectedMapping.midCol = idx;
              if (detectedMapping.bonusesCol === -1 && matchKeyword(colName, KEYWORDS.bonuses)) detectedMapping.bonusesCol = idx;
            });

            resolve({
              fileName: file.name,
              sheetName: firstSheetName,
              sheetNames: workbook.SheetNames,
              headerRowIndex,
              headers: headerRow,
              detectedMapping,
              rawRows: dataRows,
              previewRows: dataRows.slice(0, 5)
            });
          } catch (err) {
            reject(new Error('Lỗi khi đọc file Excel: ' + err.message));
          }
        };

        reader.onerror = () => reject(new Error('Không thể đọc file trên máy tính.'));
        reader.readAsArrayBuffer(file);
      });
    },

    /**
     * Chuyển đổi dữ liệu đã chọn thành danh sách sinh viên chuẩn cho sổ điểm
     * @param {Array} rawRows
     * @param {Object} mapping
     * @param {number} sessionCount
     * @returns {Array} students
     */
    extractStudents: function(rawRows, mapping, sessionCount = 11) {
      const students = [];

      rawRows.forEach((row, index) => {
        let sid = mapping.idCol >= 0 ? String(row[mapping.idCol] || '').trim() : '';
        if (!sid) {
          sid = 'SV_' + String(index + 1).padStart(3, '0');
        }

        let sname = '';
        if (mapping.nameCol >= 0 && row[mapping.nameCol]) {
          sname = String(row[mapping.nameCol]).trim();
        } else if (mapping.lastNameCol >= 0 || mapping.firstNameCol >= 0) {
          const last = mapping.lastNameCol >= 0 ? String(row[mapping.lastNameCol] || '').trim() : '';
          const first = mapping.firstNameCol >= 0 ? String(row[mapping.firstNameCol] || '').trim() : '';
          sname = `${last} ${first}`.trim();
        }
        if (!sname) sname = `Sinh viên ${index + 1}`;

        const group = mapping.groupCol >= 0 ? String(row[mapping.groupCol] || '').trim() : '';

        let activity = null;
        if (mapping.activityCol >= 0 && row[mapping.activityCol] !== '' && row[mapping.activityCol] !== undefined) {
          const val = Number(String(row[mapping.activityCol]).replace(',', '.'));
          if (Number.isFinite(val) && val >= 0 && val <= 10) activity = val;
        }

        let mid = null;
        if (mapping.midCol >= 0 && row[mapping.midCol] !== '' && row[mapping.midCol] !== undefined) {
          const val = Number(String(row[mapping.midCol]).replace(',', '.'));
          if (Number.isFinite(val) && val >= 0 && val <= 10) mid = val;
        }

        let bonuses = 0;
        if (mapping.bonusesCol >= 0 && row[mapping.bonusesCol] !== '' && row[mapping.bonusesCol] !== undefined) {
          const val = Number(row[mapping.bonusesCol]);
          if (Number.isFinite(val) && val >= 0) bonuses = Math.round(val);
        }

        students.push({
          id: sid,
          name: sname,
          group: group,
          mid: mid,
          activity: activity,
          bonuses: bonuses,
          attendance: Array(sessionCount).fill(null)
        });
      });

      return students;
    },

    /**
     * Xuất bảng điểm hoàn chỉnh ra file Excel (.xlsx) chuẩn, đẹp mắt
     * @param {Object} gradebook
     * @param {Function} summarizeFn
     */
    exportGradebookToExcel: function(gradebook, summarizeFn) {
      if (!window.XLSX) {
        alert('Thư viện Excel chưa sẵn sàng.');
        return;
      }

      const rows = [];
      // Tiêu đề & Thông tin đầu trang
      rows.push([`BẢNG TỔNG HỢP ĐIỂM QUÁ TRÌNH (50%) - ${gradebook.title || gradebook.course}`]);
      rows.push([`Môn học: ${gradebook.course || ''} | Cơ cấu: Tự học ${gradebook.weights?.self ?? 30}% - Giữa kỳ ${gradebook.weights?.mid ?? 20}%`]);
      rows.push([`Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Tổng số: ${(gradebook.students || []).length} sinh viên`]);
      rows.push([]); // Dòng trống

      // Tiêu đề các cột
      rows.push([
        'STT',
        'Mã sinh viên',
        'Họ và tên',
        'Nhóm / Lớp',
        'Bài tự học (/10)',
        'Điểm danh (/10)',
        'Tham gia (/10)',
        'Lượt cộng',
        'Điểm cộng quy đổi',
        'Giữa kỳ (/10)',
        'Điểm thành phần tự học (/10)',
        'Điểm quá trình 50% (/5)',
        'Đánh giá'
      ]);

      // Dữ liệu từng sinh viên
      (gradebook.students || []).forEach((s, idx) => {
        const r = summarizeFn(s);
        let status = 'Chưa đủ dữ liệu';
        if (r.total !== null) {
          status = r.total >= 2.5 ? 'Đạt' : 'Cần lưu ý (< 2.5)';
        }

        rows.push([
          idx + 1,
          s.id,
          s.name,
          s.group || '',
          r.a !== null ? Number(r.a.toFixed(2)) : '',
          r.d !== null ? Number(r.d.toFixed(2)) : '',
          r.p !== null ? Number(r.p.toFixed(2)) : '',
          s.bonuses || 0,
          Number(r.bonus.toFixed(2)),
          r.m !== null ? Number(r.m.toFixed(2)) : '',
          r.self !== null ? Number(r.self.toFixed(2)) : '',
          r.total !== null ? Number(r.total.toFixed(2)) : '',
          status
        ]);
      });

      // Dòng tính toán tổng kết
      const totals = (gradebook.students || []).map(s => summarizeFn(s).total).filter(v => v !== null);
      const avg = totals.length ? Number((totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(2)) : '—';
      const passCount = totals.filter(t => t >= 2.5).length;
      const passRate = totals.length ? ((passCount / totals.length) * 100).toFixed(1) + '%' : '—';

      rows.push([]);
      rows.push(['', '', 'ĐIỂM TRUNG BÌNH LỚP', '', '', '', '', '', '', '', '', avg, '']);
      rows.push(['', '', 'TỶ LỆ ĐẠT (>= 2.5/5)', '', '', '', '', '', '', '', '', passRate, `Đạt ${passCount}/${totals.length} SV`]);

      const ws = window.XLSX.utils.aoa_to_sheet(rows);

      // Thiết lập độ rộng cột cho đẹp khi mở Excel
      ws['!cols'] = [
        { wch: 6 },  // STT
        { wch: 16 }, // Mã SV
        { wch: 26 }, // Họ tên
        { wch: 14 }, // Nhóm
        { wch: 16 }, // Bài tự học
        { wch: 15 }, // Điểm danh
        { wch: 15 }, // Tham gia
        { wch: 11 }, // Lượt cộng
        { wch: 18 }, // Điểm cộng
        { wch: 15 }, // Giữa kỳ
        { wch: 25 }, // Tự học /10
        { wch: 22 }, // Đóng góp 50%
        { wch: 18 }  // Đánh giá
      ];

      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'BangDiem');

      const safeName = (gradebook.title || gradebook.course || 'Bang_diem')
        .replace(/[/\\?%*:|"<> ]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      window.XLSX.writeFile(wb, `${safeName}_${dateStr}.xlsx`);
    },

    /**
     * Tạo và tải về file Excel mẫu chuẩn
     */
    downloadSampleFile: function() {
      if (!window.XLSX) {
        alert('Thư viện Excel chưa được tải.');
        return;
      }

      const sampleData = [
        ['STT', 'Mã sinh viên', 'Họ lót', 'Tên', 'Lớp', 'Điểm chuyên cần', 'Điểm giữa kỳ', 'Lượt cộng'],
        [1, '210001', 'Nguyễn Văn', 'An', 'Nhóm 1', 9.0, 7.5, 1],
        [2, '210002', 'Trần Thị', 'Bình', 'Nhóm 1', 8.5, 8.0, 0],
        [3, '210003', 'Lê Hoàng', 'Cường', 'Nhóm 2', 9.5, 6.5, 2],
        [4, '210004', 'Phạm Minh', 'Đức', 'Nhóm 2', 10.0, 7.0, 1],
        [5, '210005', 'Võ Thị', 'Hoa', 'Nhóm 3', 8.0, 8.5, 0],
        [6, '210006', 'Đặng Quốc', 'Huy', 'Nhóm 3', 7.5, 6.0, 3],
        [7, '210007', 'Bùi Ngọc', 'Lan', 'Nhóm 4', 9.0, 9.0, 1],
        [8, '210008', 'Ngô Thanh', 'Mai', 'Nhóm 4', 8.5, 7.5, 0]
      ];

      const ws = window.XLSX.utils.aoa_to_sheet(sampleData);
      ws['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 15 }, { wch: 12 }];
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Danh sách sinh viên');
      window.XLSX.writeFile(wb, 'Bang_diem_mau_chuan.xlsx');
    }
  };

  window.ExcelParser = ExcelParser;
})(window);
