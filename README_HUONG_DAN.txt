HƯỚNG DẪN BẮT ĐẦU - CLO GRADEBOOK (BẢN MẪU)
==========================================

MỤC TIÊU
Chạy một website sổ điểm mẫu với dữ liệu giả lập, trước khi tích hợp AI.
Bạn không cần biết lập trình để thực hiện các bước dưới đây.

BƯỚC 1 - MỞ MÔI TRƯỜNG CODE
1. Truy cập https://replit.com và đăng ký tài khoản.
2. Chọn tạo ứng dụng mới (Create App hoặc tương tự).
3. Nếu có mẫu HTML/CSS/JavaScript, hãy chọn mẫu đó.
   Nếu giao diện chỉ có Replit Agent, nhập:
   "Tạo giúp tôi một trang web tĩnh bằng HTML, CSS, JavaScript,
   sử dụng một tệp index.html. Tôi sẽ thay nội dung tệp bằng mã có sẵn."

BƯỚC 2 - NẠP CODE
1. Trong Replit Workspace, mở khu vực Files.
2. Tìm tệp index.html. Nếu chưa có, tạo tệp tên index.html.
3. Mở tệp index.html tải từ ChatGPT và sao chép toàn bộ nội dung.
4. Dán đè toàn bộ nội dung tệp index.html trong Replit.
5. Chọn Run hoặc xem Preview để chạy website.

BƯỚC 3 - THỬ CÁC CHỨC NĂNG
- Tab Sổ điểm: sửa điểm giữa kỳ, điểm tham gia và lượt cộng.
- Chấm bài: nhập điểm từng tiêu chí theo nhóm.
- Điểm danh: đánh dấu Có mặt / Vắng theo từng buổi đã học.
- Rubric & CLO: sửa tên tiêu chí, mã CLO và điểm tối đa.
- Công thức & thiết lập: sửa trọng số 30% + 20%, tỷ lệ nội bộ 80/15/5,
  số buổi đã học, giá trị lượt cộng, giới hạn điểm bài.
- Xuất CSV để mở bằng Excel; xuất JSON để sao lưu và khôi phục dữ liệu.

BƯỚC 4 - HIỂU CODE
- HTML: tạo thành phần giao diện (bảng điểm, nút, ô nhập).
- CSS: làm giao diện đẹp, dễ đọc trên máy tính và điện thoại.
- JavaScript: lưu dữ liệu tạm, tính điểm và xử lý nút bấm.
- Trong file index.html, cả 3 được đặt chung để bạn dễ thử nghiệm.

BƯỚC 5 - LƯU Ý QUAN TRỌNG
- Đây là bản học lập trình, KHÔNG có AI chấm bài và KHÔNG đọc PDF/PPTX/DOCX.
- Chưa có đăng nhập, cơ sở dữ liệu máy chủ hay bảo mật cho dữ liệu thật.
- Dữ liệu chỉ lưu trong trình duyệt (localStorage) và có thể mất.
- KHÔNG nhập tên thật, mã sinh viên thật hoặc bảng điểm chính thức.
- Công thức và CLO minh họa cần đối chiếu ĐCCT trước khi dùng thực tế.

KẾ HOẠCH MỞ RỘNG
1. Thêm Supabase: tài khoản giảng viên, lưu lớp và dữ liệu an toàn.
2. Thêm nhập Excel danh sách sinh viên, tạo học phần và rubric.
3. Thêm upload PDF/PPTX/DOCX và AI đề xuất điểm theo tiêu chí,
   trả minh chứng để giảng viên phê duyệt.
4. Thêm ma trận mức đạt CLO và xuất Excel theo biểu mẫu chính thức.
