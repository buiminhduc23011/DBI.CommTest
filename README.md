<p align="center">
  <img src="docs/hero_banner.png" alt="DBI CommTest Banner" width="100%"/>
</p>

<h1 align="center">DBI CommTest</h1>

<p align="center">
  <strong>Công cụ kiểm tra giao tiếp PLC miễn phí — dành cho kỹ sư tự động hóa</strong>
</p>

<p align="center">
  <a href="#tính-năng-nổi-bật">Tính năng</a> •
  <a href="#giao-thức-hỗ-trợ">Giao thức</a> •
  <a href="#kiến-trúc">Kiến trúc</a> •
  <a href="#cài-đặt">Cài đặt</a> •
  <a href="#hướng-dẫn-sử-dụng">Hướng dẫn</a> •
  <a href="#đóng-góp">Đóng góp</a> •
  <a href="#giấy-phép">Giấy phép</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.3.0-blue?style=flat-square"/>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square"/>
  <img alt=".NET 8" src="https://img.shields.io/badge/.NET-8.0-purple?style=flat-square&logo=dotnet"/>
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react"/>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-37-9feaf9?style=flat-square&logo=electron"/>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square"/>
</p>

---

## Vấn đề mà chúng tôi giải quyết

Khi làm việc với PLC, kỹ sư tự động hóa thường gặp phải những khó khăn:

- **Thiếu công cụ kiểm tra nhẹ nhàng, đa năng** — Các phần mềm chính hãng (như TIA Portal, GX Works) rất tuyệt vời để lập trình, nhưng lại quá nặng nề nếu bạn chỉ cần test kết nối hoặc đọc/ghi vài thanh ghi.
- **Phân mảnh công cụ test** — Thông thường để test Modbus bạn dùng Modbus Poll, test Siemens lại phải tìm tool riêng. Điều này gây bất tiện, tốn thời gian chuyển đổi và đôi khi tốn kém chi phí mua từng tool lẻ.
- **Thiết lập rườm rà khi debug communication** — Đôi khi hệ thống IT/OT hoặc SCADA không nhận tín hiệu, bạn chỉ cần một ứng dụng độc lập, cấu hình cực nhanh để "soi" trực tiếp dữ liệu đang nằm trong PLC.

**DBI CommTest** ra đời để giải quyết tất cả những vấn đề trên — **hoàn toàn miễn phí**.

---

## Tính năng nổi bật

### Kết nối đa giao thức
Một ứng dụng duy nhất kết nối được với PLC của **nhiều hãng khác nhau** — không cần cài thêm phần mềm, không cần license.

### Giám sát thanh ghi thời gian thực
Bảng Watch Table kiểu công nghiệp với polling liên tục, hiển thị giá trị, trạng thái chất lượng tín hiệu (Good/Bad/Timeout), và thời gian cập nhật cho từng tag.

### Multi-Watch Tables
Tạo **nhiều bảng Watch Table độc lập** trên cùng một giao diện, chia dọc hoặc ngang tùy ý — giống như các phần mềm SCADA chuyên nghiệp.

### Đọc & Ghi thanh ghi
Không chỉ đọc mà còn **ghi trực tiếp giá trị** vào thanh ghi PLC — hỗ trợ kiểm tra I/O, force bit, và tuning tham số ngay trên giao diện.

### Quản lý Profile thiết bị
Lưu trữ cấu hình kết nối thành **profile** để tái sử dụng. Mỗi profile bao gồm tất cả thông tin kết nối, danh sách thanh ghi, và cấu hình polling — mở lại là chạy ngay.

### Giao diện Dark / Light Mode
Giao diện desktop chuyên nghiệp với thiết kế high-density, hỗ trợ **Dark Mode** hoàn chỉnh — từ thanh tiêu đề, tab, bảng dữ liệu đến status bar.

### Ứng dụng Desktop native
Đóng gói bằng Electron, chạy như ứng dụng desktop thực thụ trên **Windows, macOS và Linux** — không cần trình duyệt, không cần internet.

---

## Giao thức hỗ trợ

| Hãng PLC | Giao thức | Driver | Trạng thái |
|:---------|:----------|:-------|:----------:|
| **Generic** | Modbus TCP/RTU | FluentModbus | ✅ Sẵn sàng |
| **Siemens** | S7-1200 / S7-1500 | Sharp7 | ✅ Sẵn sàng |
| **Mitsubishi** | FX3U / FX5U (MC Protocol) | McpX | ✅ Sẵn sàng |
| **Delta** | AS Series / DVP Series | DBI.Drivers.Delta.PLC | ✅ Sẵn sàng |

### Kiểu dữ liệu hỗ trợ

| Kiểu | Kích thước | Mô tả |
|:-----|:-----------|:------|
| `Bool` | 1 bit | Tín hiệu ON/OFF |
| `Int16` | 16-bit | Số nguyên có dấu |
| `UInt16` / `Word` | 16-bit | Số nguyên không dấu |
| `Int32` / `DInt` | 32-bit | Số nguyên có dấu kép |
| `UInt32` / `DWord` | 32-bit | Số nguyên không dấu kép |
| `Float` / `Real` | 32-bit | Số thực dấu phẩy động |

---

## Kiến trúc

DBI CommTest sử dụng kiến trúc **3 lớp** hiện đại:

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Shell                        │
│              (Native Window, IPC, Tray)                  │
├─────────────────────────────────────────────────────────┤
│                    React Frontend                        │
│    Vite + React 19 + Ant Design + FlexLayout             │
│    ┌──────────┬──────────┬──────────┬──────────┐        │
│    │  Header  │  Watch   │  Watch   │  Status  │        │
│    │  Bar     │ Table 1  │ Table N  │  Bar     │        │
│    └──────────┴──────────┴──────────┴──────────┘        │
├───────────────── REST API (HTTP) ───────────────────────┤
│                   .NET 8 Backend                         │
│    ┌──────────┬──────────┬──────────┬──────────┐        │
│    │Connection│  Read    │  Pack    │   Log    │        │
│    │ Manager  │ Executor │ Planner  │ Pipeline │        │
│    └──────────┴──────────┴──────────┴──────────┘        │
│    ┌──────────┬──────────┬──────────┬──────────┐        │
│    │ Modbus   │ Siemens  │ Mitsu-   │  Delta   │        │
│    │ Adapter  │ S7 Adapt │ bishi Ad │ Adapter  │        │
│    └──────────┴──────────┴──────────┴──────────┘        │
├─────────────────────────────────────────────────────────┤
│                    SQLite Database                        │
│          (Connections, Profiles, Migrations)              │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Công nghệ |
|:------|:----------|
| **Frontend** | React 19 · TypeScript · Vite 7 · Ant Design 5 · FlexLayout |
| **Backend** | .NET 8 · Minimal API · SQLite |
| **Shell** | Electron 37 · Context Isolation · Sandbox |
| **Drivers** | FluentModbus · Sharp7 · McpX · DBI.Drivers.Delta.PLC |

---

## Cài đặt

DBI CommTest được phân phối dưới dạng phần mềm Portable (không cần môi trường phức tạp). Bạn có thể dễ dàng sử dụng bằng cách:

1. Truy cập vào trang **Releases** của mã nguồn này.
2. Tải về file trình cài đặt `.exe` (hoặc định dạng tương ứng cho hệ điều hành của bạn).
3. Mở lên và bắt đầu sử dụng ngay — không cần phải cài đặt thêm dependencies nào.

---

## Hướng dẫn sử dụng

### 1. Tạo Profile kết nối

Nhấn nút **`+`** trên thanh toolbar để tạo profile mới:

- **Tên profile** — Tên gợi nhớ (VD: `PLC Dây chuyền 1`)
- **Protocol** — Chọn giao thức (Modbus TCP, Siemens S7, ...)
- **Host & Port** — Địa chỉ IP và cổng của PLC
- **Poll Interval** — Chu kỳ đọc dữ liệu (ms)

### 2. Thêm thanh ghi vào Watch Table

Trong bảng Watch Table, nhấn **Add Register** để thêm tag mới:

| Trường | Ví dụ | Mô tả |
|:-------|:------|:------|
| **Tag Name** | `Motor_Run` | Tên nhận dạng |
| **Address** | `00001` | Địa chỉ thanh ghi PLC |
| **Data Type** | `Bool` | Kiểu dữ liệu |
| **R/W** | `R` hoặc `W` | Chế độ đọc/ghi |

### 3. Kết nối & Giám sát

1. Nhấn nút **▶ Start** để bắt đầu kết nối
2. Hệ thống tự động polling theo chu kỳ đã cấu hình
3. Theo dõi trạng thái trên **Status Bar**:
   - 🟢 **Polling** — Đang đọc dữ liệu liên tục
   - 🔵 **Starting** — Đang thiết lập kết nối
   - 🔴 **Error** — Có lỗi kết nối
   - ⚪ **Stopped** — Đã dừng

### 4. Ghi giá trị

Với các thanh ghi có chế độ **W** (Write), bạn có thể nhập giá trị trực tiếp vào cột Value và ghi xuống PLC.

### 5. Lưu & Tải Profile

- **💾 Save** — Lưu toàn bộ cấu hình hiện tại (kết nối + thanh ghi) thành profile
- **📂 Load** — Mở Profile Manager để chọn và tải profile đã lưu
- Profile được lưu trong **localStorage** của ứng dụng

---

## Cấu trúc dự án

```
DBI.CommTest/
├── app-shell/              # Electron desktop wrapper
│   └── src/
│       ├── main.ts         #   Main process (window, IPC, theme)
│       └── preload.ts      #   Context bridge
│
├── backend/                # .NET 8 API server
│   └── src/
│       ├── Api/            #   REST endpoints
│       ├── Data/           #   SQLite database & migrations
│       ├── Drivers/        #   PLC communication layer
│       │   ├── Adapters/   #     Modbus, Siemens, Mitsubishi, Delta
│       │   ├── Execution/  #     Read executor engine
│       │   ├── Parsing/    #     Address parser
│       │   └── Planning/   #     Read pack planner (batching)
│       ├── Models/         #   Data models
│       └── Services/       #   Connection manager, CRUD, logging
│
├── frontend/               # React 19 + Vite web application
│   └── src/
│       ├── routes/Home/    #   Main monitor interface
│       │   ├── components/ #     Header, StatusBar, Tabs, Modals
│       │   ├── hooks/      #     useHomeState (state management)
│       │   ├── api.ts      #     Backend API client
│       │   ├── types.ts    #     TypeScript interfaces
│       │   └── utils.ts    #     Helper functions
│       ├── App.tsx         #   App router
│       ├── ThemeContext.tsx #   Dark/Light mode system
│       └── styles.css      #   Global styles
│
└── package.json            # Root orchestration scripts
```

---

## Đóng góp

DBI CommTest là dự án **mã nguồn mở** và chào đón mọi đóng góp từ cộng đồng!

### Cách đóng góp

1. **Fork** repository này
2. Tạo **branch** cho tính năng mới (`git checkout -b feature/ten-tinh-nang`)
3. **Commit** thay đổi (`git commit -m 'Thêm tính năng mới'`)
4. **Push** lên branch (`git push origin feature/ten-tinh-nang`)
5. Tạo **Pull Request**

### Ý tưởng đóng góp

- Thêm driver cho hãng PLC mới (ABB, Omron, Schneider, ...)
- Hỗ trợ đa ngôn ngữ (i18n)
- Viết unit test & integration test
- Cải thiện tài liệu

---

## Roadmap

- [x] Kết nối Modbus TCP
- [x] Kết nối Siemens S7-1200/1500
- [x] Kết nối Mitsubishi FX3U/FX5U
- [x] Kết nối Delta AS/DVP
- [x] Multi-Watch Tables
- [x] Dark / Light Mode
- [x] Profile management
- [ ] Modbus RTU (Serial)
- [ ] Auto-discovery thiết bị trên mạng

---

## Giấy phép

Dự án này được phân phối theo giấy phép **MIT License** — bạn có thể tự do sử dụng, sửa đổi và phân phối cho mục đích cá nhân lẫn thương mại.

---

<p align="center">
  <strong>Được phát triển bởi DBI Team 🇻🇳</strong>
</p>
