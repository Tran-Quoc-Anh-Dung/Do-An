# 📋 Tài liệu Use Case & Thiết kế hệ thống POS Văn Phòng Phẩm

## 📚 Danh sách file tài liệu

| File | Nội dung | Dạng |
|------|---------|------|
| **USE_CASE.md** | Use case diagram, phân quyền, mối quan hệ | Markdown + Mermaid |
| **use_case_diagram.md** | Sơ đồ use case tương tác | Mermaid |
| **CLASS_DIAGRAM.md** | Sơ đồ class, mô tả các entities | Markdown + Mermaid |
| **ER_DIAGRAM.md** | Sơ đồ thực thể - mối quan hệ database | Markdown + Mermaid |
| **STATE_DIAGRAM.md** | Sơ đồ trạng thái của Order, Shift, PO... | Markdown + Mermaid |
| **SEQUENCE_DIAGRAM.md** | Sơ đồ tuần tự (workflow các flow chính) | Markdown + Mermaid |

---

## 🎯 Tóm tắt dự án

**POS Văn Phòng Phẩm** là một hệ thống quản lý bán hàng toàn diện cho cửa hàng bán văn phòng phẩm với các tính năng:

### ✨ Tính năng chính

1. **Bán hàng POS** 🛒
   - Giao diện bán hàng trực quan
   - Quản lý giỏ hàng
   - Nhiều phương thức thanh toán (tiền mặt, chuyển khoản, QR)

2. **Quản lý ca làm việc** ⏰
   - Mở/chốt ca
   - Ghi nhận tiền đầu ca
   - Tính chênh lệch tiền mặt

3. **Quản lý sản phẩm** 📦
   - CRUD sản phẩm
   - Quản lý danh mục
   - Cập nhật tồn kho tự động

4. **Quản lý đơn hàng nhập** 📋
   - Tạo Purchase Order (PO)
   - Theo dõi trạng thái
   - Nhập hàng & cập nhật tồn kho

5. **Hóa đơn GTGT** 📄
   - Tạo hóa đơn GTGT
   - Xuất PDF tiếng Việt
   - Gửi email tới khách hàng

6. **Báo cáo & Phân tích** 📈
   - Báo cáo doanh thu (ngày, tuần, tháng)
   - Biểu đồ cột, đường, tròn
   - Xuất CSV/PDF

7. **Phân tích AI** 🤖
   - Sử dụng Ollama LLM
   - Phân tích tồn kho
   - Gợi ý nhập hàng
   - Dự báo bán hết

8. **Quản lý khách hàng** 👥
   - Lưu thông tin khách
   - Tích lũy điểm
   - Lịch sử mua hàng

9. **Quản lý người dùng** 👤
   - Quản lý tài khoản nhân viên
   - 3 vai trò: Admin, Manager, Seller
   - Xác thực & phân quyền

---

## 👥 Người dùng chính (Actors)

### 1. 👨‍💼 **Admin** (Quản trị viên)
- ✅ Quản lý tất cả người dùng
- ✅ Quản lý sản phẩm, danh mục
- ✅ Xem báo cáo toàn hệ thống
- ✅ Cấu hình hệ thống

### 2. 👔 **Manager** (Quản lý cửa hàng)
- ✅ Bán hàng POS
- ✅ Quản lý ca làm việc
- ✅ Quản lý PO (mua hàng)
- ✅ Nhập hàng
- ✅ Tạo & gửi hóa đơn GTGT
- ✅ Xem báo cáo doanh thu
- ✅ Phân tích AI tồn kho

### 3. 🛍️ **Seller** (Nhân viên bán hàng)
- ✅ Bán hàng POS
- ✅ Mở/chốt ca
- ✅ Xem chi tiết sản phẩm

### 4. 👥 **Customer** (Khách hàng)
- ✅ Mua hàng
- ✅ Tích lũy điểm
- ✅ Xem lịch sử mua

---

## 📊 Use Cases chính (21 use cases)

### Quản lý Người dùng (3)
- 🔐 Đăng nhập
- 🔑 Đổi mật khẩu
- 👥 Quản lý nhân viên (Admin)

### Bán hàng & POS (5)
- 🛒 Bán hàng (POS)
- 📂 Mở ca làm việc
- 💰 Chốt ca làm việc
- 📝 Tạo đơn hàng
- 💳 Thanh toán

### Quản lý Sản phẩm (3)
- 📦 Quản lý sản phẩm (Admin)
- 📊 Cập nhật tồn kho
- 👁️ Xem chi tiết sản phẩm

### Quản lý PO (4)
- 📋 Tạo PO
- 📰 Xem danh sách PO
- ✏️ Cập nhật PO
- 📥 Nhập hàng

### Hóa đơn GTGT (3)
- 📄 Tạo hóa đơn GTGT
- ✉️ Gửi hóa đơn qua email
- 📄 Xuất PDF

### Báo cáo & Phân tích (4)
- 📈 Xem báo cáo doanh thu
- 🤖 Phân tích tồn kho với AI
- 📊 Xem biểu đồ bán hàng
- 📥 Xuất báo cáo CSV

### Quản lý Khách hàng (3)
- 👤 Quản lý khách hàng
- ⭐ Tích lũy điểm
- 📜 Xem lịch sử mua

---

## 🗄️ Cơ sở dữ liệu (12 bảng chính)

```
USERS
├── id (PK)
├── username (UNIQUE)
├── password (hashed)
├── role (admin|manager|seller)
└── ...

PRODUCTS
├── id (PK)
├── name
├── sku (UNIQUE)
├── barcode
├── price, cost
├── stock
└── categoryId (FK)

CATEGORIES
├── id (PK)
├── name
└── ...

CUSTOMERS
├── id (PK)
├── name
├── phone (UNIQUE)
├── email
├── points
└── ...

ORDERS
├── id (PK)
├── orderNumber (UNIQUE)
├── customerId (FK)
├── sellerId (FK)
├── shiftId (FK)
├── totalAmount
├── status
├── paymentMethod
└── ...

ORDER_ITEMS
├── id (PK)
├── orderId (FK)
├── productId (FK)
├── quantity
├── unitPrice
└── ...

SHIFTS
├── id (PK)
├── userId (FK)
├── startingCash
├── closingCash
├── totalSales
├── cashDifference
└── ...

PURCHASE_ORDERS
├── id (PK)
├── poNumber (UNIQUE)
├── supplier
├── status
└── ...

PO_ITEMS
├── id (PK)
├── poId (FK)
├── productId (FK)
├── quantity
└── ...

INVOICES
├── id (PK)
├── invoiceNumber (UNIQUE)
├── orderId (FK)
├── customerId (FK)
├── totalAmount
└── ...

TRANSACTIONS
├── id (PK)
├── type (sale|return)
├── referenceId (FK)
├── amount
└── ...

REPORTS
├── id (PK)
├── type (daily|weekly)
├── startDate, endDate
└── ...
```

---

## 🔄 Các Flow chính

### 1️⃣ **Flow Bán hàng** (7 bước)
```
Chọn sản phẩm
    ↓
Chọn khách hàng
    ↓
Xem lại đơn
    ↓
Chọn thanh toán
    ↓
Cập nhật tồn kho
    ↓
Tích lũy điểm
    ↓
✓ Tạo GTGT & gửi email
```

### 2️⃣ **Flow Quản lý hàng tồn** (6 bước)
```
Kiểm tra tồn kho
    ↓
Phân tích AI
    ↓
Nhận gợi ý
    ↓
Tạo PO
    ↓
Gửi PO
    ↓
✓ Nhập hàng & cập nhật
```

### 3️⃣ **Flow Báo cáo** (5 bước)
```
Chọn khoảng ngày
    ↓
Áp dụng bộ lọc
    ↓
Tải dữ liệu từ DB
    ↓
Vẽ biểu đồ
    ↓
✓ Xuất báo cáo
```

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────┐
│         Frontend (React/Vanilla JS)         │
│  - Dashboard, POS, Reports, GTGT Invoice    │
└────────────────┬────────────────────────────┘
                 │ (HTTPS/ngrok)
┌────────────────▼────────────────────────────┐
│         Backend API (Node.js/Express)       │
│  - Authentication, Authorization            │
│  - Orders, Products, PO Management          │
│  - Reports & Analytics                      │
│  - GTGT Invoice Generation (pdfkit)         │
│  - Email Service (nodemailer)               │
│  - AI Analysis (Ollama Integration)         │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│    Database (MySQL - Railway Platform)      │
│  - Users, Products, Orders, Customers       │
│  - Shifts, Transactions, PO, Invoices       │
└─────────────────────────────────────────────┘
```

### External Services
- 📧 **Email**: SMTP (Gmail)
- 🤖 **AI**: Ollama LLM (Local)
- 💳 **Payment**: VietQR (for QR codes)
- ☁️ **Hosting**: ngrok (Tunnel), Railway (DB)

---

## 📋 Phân quyền theo vai trò

| Chức năng | Admin | Manager | Seller | Customer |
|-----------|-------|---------|--------|----------|
| Đăng nhập | ✅ | ✅ | ✅ | ✅ |
| Quản lý nhân viên | ✅ | ❌ | ❌ | ❌ |
| Quản lý sản phẩm | ✅ | ❌ | 👁️ | 👁️ |
| Bán hàng POS | ❌ | ✅ | ✅ | ❌ |
| Mở/Chốt ca | ✅ | ✅ | ✅ | ❌ |
| Quản lý PO | ❌ | ✅ | ❌ | ❌ |
| Tạo GTGT | ❌ | ✅ | ❌ | ❌ |
| Báo cáo | ✅ | ✅ | ❌ | ❌ |
| Phân tích AI | ❌ | ✅ | ❌ | ❌ |

---

## 📖 Hướng dẫn sử dụng tài liệu

1. **Bắt đầu**: Đọc `USE_CASE.md` để hiểu tổng quan
2. **Thiết kế**: Xem `CLASS_DIAGRAM.md` và `ER_DIAGRAM.md`
3. **Flow**: Xem `SEQUENCE_DIAGRAM.md` để hiểu cách hoạt động
4. **Trạng thái**: Xem `STATE_DIAGRAM.md` để hiểu các trạng thái

---

## 🔗 Liên kết tài liệu

- [Use Case Diagram](./use_case_diagram.md)
- [Class Diagram](./CLASS_DIAGRAM.md)
- [ER Diagram](./ER_DIAGRAM.md)
- [State Diagram](./STATE_DIAGRAM.md)
- [Sequence Diagram](./SEQUENCE_DIAGRAM.md)

---

## 📝 Thông tin bổ sung

- **Ngôn ngữ**: Vietnamese (Tiếng Việt)
- **Tech Stack**: Node.js, Express, MySQL, Vanilla JS
- **Database**: Railway MySQL
- **Hosting**: ngrok (Development)
- **AI**: Ollama
- **Email**: Gmail SMTP
- **PDF**: pdfkit (Unicode hỗ trợ tiếng Việt)

---

**Cập nhật**: 2026-07-08
**Version**: 1.0
