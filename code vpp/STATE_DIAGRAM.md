# State Diagram - POS Văn Phòng Phẩm

## 1. Trạng thái Order (Đơn hàng)

```mermaid
stateDiagram-v2
    [*] --> Draft: Tạo đơn
    Draft --> Pending: Xác nhận
    Pending --> Completed: Thanh toán thành công
    Pending --> Failed: Thanh toán thất bại
    Failed --> Pending: Thử lại
    Completed --> Invoiced: Tạo GTGT
    Invoiced --> Sent: Gửi hóa đơn
    Pending --> Cancelled: Hủy đơn
    Completed --> Cancelled: Hoàn trả
    Cancelled --> [*]
    Sent --> [*]
    
    note right of Draft
        Chọn sản phẩm, khách hàng
        Tính toán tổng tiền
    end note
    
    note right of Pending
        Chờ thanh toán
        Tiền mặt/Transfer/QR
    end note
    
    note right of Completed
        Thanh toán thành công
        Cập nhật tồn kho
        Tích lũy điểm khách
    end note
    
    note right of Invoiced
        Tạo hóa đơn GTGT
        Lưu vào database
    end note
    
    note right of Sent
        Gửi email cho khách
        Bản ghi lưu
    end note
```

## 2. Trạng thái Shift (Ca làm việc)

```mermaid
stateDiagram-v2
    [*] --> Closed: Ca chưa mở
    Closed --> Open: Mở ca (nhập tiền đầu ca)
    Open --> Closing: Yêu cầu chốt ca
    Closing --> Closed: Chốt ca hoàn tất
    
    note right of Open
        - Bán hàng
        - Ghi nhận doanh thu
        - Mở/chốt ca
    end note
    
    note right of Closing
        - Tính tổng doanh thu
        - So sánh tiền mặt
        - Ghi sai số
        - Xác nhận chốt
    end note
```

## 3. Trạng thái Purchase Order (Đơn hàng nhập)

```mermaid
stateDiagram-v2
    [*] --> Draft: Tạo PO
    Draft --> Submitted: Gửi đơn
    Submitted --> Ordered: Nhà cung cấp xác nhận
    Ordered --> PartiallyReceived: Nhận hàng một phần
    PartiallyReceived --> Received: Nhận đủ hàng
    Ordered --> Received: Nhận đủ hàng ngay
    Submitted --> Cancelled: Hủy đơn
    Cancelled --> [*]
    Received --> [*]
    
    note right of Draft
        Thêm sản phẩm
        Chỉnh sửa số lượng, giá
    end note
    
    note right of Submitted
        Gửi nhà cung cấp
        Chờ xác nhận
    end note
    
    note right of Ordered
        Nhà cung cấp đã xác nhận
        Chờ giao hàng
    end note
    
    note right of PartiallyReceived
        Nhận một phần hàng
        Cập nhật tồn kho
    end note
    
    note right of Received
        Nhận đủ hàng
        Đóng PO
    end note
```

## 4. Trạng thái Invoice (Hóa đơn GTGT)

```mermaid
stateDiagram-v2
    [*] --> Draft: Tạo hóa đơn
    Draft --> Issued: Phát hành
    Issued --> Sent: Gửi email
    Sent --> Delivered: Khách nhận
    Issued --> Cancelled: Hủy
    Cancelled --> [*]
    Delivered --> [*]
    
    note right of Draft
        Lấy từ Order
        Chưa gửi
    end note
    
    note right of Issued
        Hóa đơn chính thức
        Có thể gửi
    end note
    
    note right of Sent
        Gửi tới email khách
        Ghi lại thời gian
    end note
```

## 5. Trạng thái User (Người dùng)

```mermaid
stateDiagram-v2
    [*] --> Active: Tạo tài khoản
    Active --> Inactive: Vô hiệu hóa
    Inactive --> Active: Kích hoạt
    Active --> Locked: Nhập sai mật khẩu quá lần
    Locked --> Active: Unlock bởi Admin
    Active --> [*]: Xóa
    Inactive --> [*]: Xóa
    Locked --> [*]: Xóa
    
    note right of Active
        Có thể đăng nhập
        Sử dụng hệ thống
    end note
    
    note right of Inactive
        Không thể đăng nhập
        Dữ liệu giữ lại
    end note
    
    note right of Locked
        Bị khóa tạm thời
        Admin phải mở khóa
    end note
```

---

## 6. Flow tổng quát bán hàng (End-to-End)

```mermaid
stateDiagram-v2
    [*] --> OpenShift: 🔓 Mở ca
    
    OpenShift --> SelectCustomer: Chọn khách
    SelectCustomer --> SelectProducts: Chọn sản phẩm
    SelectProducts --> ApplyDiscount: Áp dụng chiết khấu
    ApplyDiscount --> ReviewOrder: Xem lại đơn
    
    ReviewOrder --> PaymentMethod: 💳 Chọn thanh toán
    PaymentMethod --> CashPayment: Tiền mặt
    PaymentMethod --> TransferPayment: Chuyển khoản
    PaymentMethod --> QRPayment: Mã QR
    
    CashPayment --> PaymentSuccess: ✓ Thanh toán OK
    TransferPayment --> PaymentSuccess: ✓ Thanh toán OK
    QRPayment --> PaymentSuccess: ✓ Thanh toán OK
    
    PaymentSuccess --> UpdateStock: Cập nhật tồn kho
    UpdateStock --> AccumulatePoints: 🎁 Tích lũy điểm
    
    AccumulatePoints --> CreateInvoice: 📄 Tạo GTGT?
    CreateInvoice --> GeneratePDF: Xuất PDF
    GeneratePDF --> SendEmail: ✉️ Gửi email
    SendEmail --> RecordTransaction: 📝 Lưu giao dịch
    
    RecordTransaction --> CloseOrder: ✔️ Đóng đơn
    CloseOrder --> MoreOrders: Bán thêm?
    MoreOrders -->|Có| SelectCustomer
    MoreOrders -->|Không| CloseShift: 🔒 Chốt ca
    
    CloseShift --> CountCash: 💰 Đếm tiền
    CountCash --> CompareAmounts: So sánh tổng tiền
    CompareAmounts --> RecordDifference: Ghi sai số
    RecordDifference --> [*]: Hoàn thành ca
```

---

## 7. Flow quản lý hàng tồn (Inventory Management)

```mermaid
stateDiagram-v2
    [*] --> CheckStock: 📊 Kiểm tra tồn kho
    
    CheckStock --> LowStock: Sắp hết?
    LowStock -->|Không| [*]
    LowStock -->|Có| AnalyzeAI: 🤖 Phân tích AI
    
    AnalyzeAI --> Recommendation: Gợi ý nhập hàng
    Recommendation --> CreatePO: 📋 Tạo PO
    CreatePO --> SelectSupplier: Chọn nhà cung cấp
    SelectSupplier --> AddItems: Thêm sản phẩm
    AddItems --> ReviewPO: Xem lại PO
    
    ReviewPO --> SubmitPO: Gửi PO
    SubmitPO --> WaitingConfirm: ⏳ Chờ xác nhận
    
    WaitingConfirm --> ReceiveGoods: 📦 Nhận hàng
    ReceiveGoods --> UpdateStock: Cập nhật tồn kho
    UpdateStock --> ClosePO: ✔️ Đóng PO
    
    ClosePO --> [*]
```

---

## 8. Flow báo cáo & phân tích

```mermaid
stateDiagram-v2
    [*] --> AccessReports: 📈 Vào báo cáo
    
    AccessReports --> SelectPeriod: Chọn kỳ báo cáo
    SelectPeriod --> ApplyFilters: Áp dụng bộ lọc
    
    ApplyFilters --> ChooseReport: Chọn loại báo cáo
    
    ChooseReport --> SalesReport: Báo cáo bán hàng
    ChooseReport --> ProductReport: Báo cáo sản phẩm
    ChooseReport --> CustomerReport: Báo cáo khách hàng
    ChooseReport --> StaffReport: Báo cáo nhân viên
    
    SalesReport --> ViewCharts: 📊 Xem biểu đồ
    ProductReport --> ViewCharts
    CustomerReport --> ViewCharts
    StaffReport --> ViewCharts
    
    ViewCharts --> ChooseFormat: Chọn định dạng xuất
    ChooseFormat --> ExportCSV: CSV
    ChooseFormat --> ExportPDF: PDF
    ChooseFormat --> ViewOnScreen: Xem trên màn hình
    
    ExportCSV --> [*]
    ExportPDF --> [*]
    ViewOnScreen --> [*]
```

---

## 9. Flow phân tích AI tồn kho

```mermaid
stateDiagram-v2
    [*] --> ClickAnalyze: 🤖 Nhấn Phân tích AI
    
    ClickAnalyze --> FetchData: Lấy dữ liệu
    FetchData --> CallOllama: Gọi Ollama API
    
    CallOllama --> Processing: ⏳ Xử lý
    Processing --> Success: Thành công
    Processing --> Error: Lỗi
    
    Error --> RetryOption: Thử lại?
    RetryOption -->|Có| CallOllama
    RetryOption -->|Không| [*]
    
    Success --> RenderCharts: 📊 Vẽ biểu đồ
    RenderCharts --> DisplayAnalysis: Hiển thị phân tích
    DisplayAnalysis --> ShowRecommendation: 💡 Gợi ý
    
    ShowRecommendation --> ApplyRecommendation: Áp dụng?
    ApplyRecommendation -->|Có| CreatePO: Tạo PO
    ApplyRecommendation -->|Không| [*]
    
    CreatePO --> [*]
```

---

## Bảng tóm tắt trạng thái

| Đối tượng | Trạng thái | Mô tả |
|-----------|-----------|-------|
| **Order** | Draft | Tạo đơn, chưa xác nhận |
| | Pending | Chờ thanh toán |
| | Completed | Thanh toán thành công |
| | Invoiced | Tạo hóa đơn |
| | Sent | Gửi hóa đơn |
| | Cancelled | Hủy đơn |
| **Shift** | Closed | Ca chưa mở / đã chốt |
| | Open | Ca đang mở |
| | Closing | Đang chốt ca |
| **PO** | Draft | Tạo PO, chưa gửi |
| | Submitted | Gửi nhà cung cấp |
| | Ordered | Nhà cung cấp xác nhận |
| | PartiallyReceived | Nhận hàng một phần |
| | Received | Nhận đủ hàng |
| | Cancelled | Hủy PO |
| **Invoice** | Draft | Tạo hóa đơn |
| | Issued | Phát hành |
| | Sent | Gửi email |
| | Cancelled | Hủy hóa đơn |
| **User** | Active | Tài khoản hoạt động |
| | Inactive | Tài khoản bị vô hiệu |
| | Locked | Tài khoản bị khóa |
