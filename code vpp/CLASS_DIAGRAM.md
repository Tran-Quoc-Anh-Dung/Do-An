# Class Diagram - POS Văn Phòng Phẩm

```mermaid
classDiagram
    class User {
        -id: int
        -username: string
        -password: string (hashed)
        -fullName: string
        -email: string
        -role: string (admin|manager|seller)
        -createdAt: datetime
        -updatedAt: datetime
        +login()
        +changePassword()
        +logout()
    }

    class Product {
        -id: int
        -name: string
        -sku: string
        -barcode: string
        -category: string
        -price: decimal
        -cost: decimal
        -stock: int
        -image: string
        -description: string
        -createdAt: datetime
        +getStock()
        +updateStock()
        +getPrice()
    }

    class Order {
        -id: int
        -orderNumber: string
        -customer_id: int
        -seller_id: int
        -totalAmount: decimal
        -status: string (pending|completed|cancelled)
        -paymentMethod: string (cash|transfer|qr)
        -createdAt: datetime
        +addItem()
        +removeItem()
        +calculateTotal()
        +markComplete()
    }

    class OrderItem {
        -id: int
        -order_id: int
        -product_id: int
        -quantity: int
        -unitPrice: decimal
        -subtotal: decimal
        -discount: decimal
        +getSubtotal()
    }

    class Customer {
        -id: int
        -name: string
        -phone: string
        -email: string
        -address: string
        -company: string
        -taxId: string
        -points: int
        -createdAt: datetime
        +addPoints()
        +redeemPoints()
        +getOrderHistory()
    }

    class Shift {
        -id: int
        -user_id: int
        -startTime: datetime
        -endTime: datetime
        -startingCash: decimal
        -closingCash: decimal
        -totalSales: decimal
        -cashDifference: decimal
        -status: string (open|closed)
        +open()
        +close()
        +calculateDifference()
    }

    class PurchaseOrder {
        -id: int
        -poNumber: string
        -supplier: string
        -totalAmount: decimal
        -status: string (draft|ordered|received)
        -orderedDate: datetime
        -receivedDate: datetime
        -createdBy: int
        +addItem()
        +submitOrder()
        +receiveOrder()
    }

    class POItem {
        -id: int
        -po_id: int
        -product_id: int
        -quantity: int
        -unitPrice: decimal
        -subtotal: decimal
    }

    class Invoice {
        -id: int
        -invoiceNumber: string
        -order_id: int
        -customer_id: int
        -totalAmount: decimal
        -taxAmount: decimal
        -createdAt: datetime
        -sentAt: datetime
        +generatePDF()
        +sendEmail()
    }

    class Transaction {
        -id: int
        -type: string (sale|return|adjustment)
        -reference_id: int
        -amount: decimal
        -notes: string
        -createdAt: datetime
    }

    class Report {
        -id: int
        -type: string (daily|weekly|monthly)
        -startDate: date
        -endDate: date
        -totalSales: decimal
        -ordersCount: int
        -productsCount: int
        -generatedAt: datetime
        +generateChart()
        +exportCSV()
        +exportPDF()
    }

    class AIAnalysis {
        -id: int
        -type: string (inventory|sales|forecast)
        -prompt: string
        -response: string
        -createdAt: datetime
        +analyzeInventory()
        +analyzeSales()
    }

    class Category {
        -id: int
        -name: string
        -description: string
        -imageUrl: string
        -createdAt: datetime
    }

    %% Relationships
    User "1" --> "*" Order : creates
    User "1" --> "*" Shift : works
    User "1" --> "*" PurchaseOrder : creates

    Customer "1" --> "*" Order : places
    
    Product "1" --> "*" OrderItem : contains
    Product "1" --> "*" POItem : in_po
    Product "*" --> "1" Category : belongs_to

    Order "1" --> "*" OrderItem : has
    Order "1" --> "1" Invoice : generates

    Shift "1" --> "*" Order : records

    PurchaseOrder "1" --> "*" POItem : has
    PurchaseOrder "1" --> "*" Transaction : creates

    Order "1" --> "*" Transaction : creates
```

## Mô tả các Class chính

### 1. **User** - Người dùng hệ thống
- Quản lý tài khoản, mật khẩu, vai trò (admin, manager, seller)
- Liên kết với các Order, Shift, PurchaseOrder

### 2. **Product** - Sản phẩm
- Quản lý thông tin sản phẩm, giá, tồn kho
- Liên kết với Category, OrderItem, POItem

### 3. **Order** - Đơn bán hàng
- Lưu thông tin đơn hàng, khách hàng, tổng tiền
- Chứa nhiều OrderItem (từng dòng sản phẩm)
- Tạo Invoice GTGT

### 4. **OrderItem** - Chi tiết từng dòng đơn hàng
- Lưu sản phẩm, số lượng, đơn giá
- Tính subtotal riêng cho mỗi item

### 5. **Customer** - Khách hàng
- Quản lý thông tin khách hàng, điểm tích lũy
- Lịch sử mua hàng liên kết với Order

### 6. **Shift** - Ca làm việc
- Lưu thời gian mở/chốt ca, tiền đầu ca, tiền chốt
- Liên kết với User và Order

### 7. **PurchaseOrder** - Đơn hàng nhập
- Quản lý đơn nhập từ nhà cung cấp
- Chứa nhiều POItem

### 8. **Invoice** - Hóa đơn GTGT
- Tạo từ Order, có thể gửi email hoặc xuất PDF
- Liên kết với Order và Customer

### 9. **Transaction** - Giao dịch
- Lưu record của mỗi giao dịch (bán, trả, điều chỉnh)
- Tham chiếu đến Order hoặc PO

### 10. **Report** - Báo cáo
- Sinh báo cáo theo kỳ (ngày, tuần, tháng)
- Có thể xuất biểu đồ, CSV, PDF

### 11. **AIAnalysis** - Phân tích AI
- Lưu trữ request và response từ Ollama
- Hỗ trợ phân tích tồn kho, bán hàng

### 12. **Category** - Danh mục sản phẩm
- Phân loại sản phẩm, quản lý hình ảnh
