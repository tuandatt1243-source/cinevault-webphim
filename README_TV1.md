# Titofilm — Hướng Dẫn Chạy & Kiểm Thử Phần TV1 (Windows)

> **Phạm vi TV1**: MongoDB (5 collections, JSON Schema Validation, Indexes, Aggregation) · FastAPI Async Backend (Auth, JWT, RBAC, CRUD Phim Soft Delete, Reviews, Watchlist, Admin APIs) · Seed Idempotent (600 phim thực tế, 220 user, 6.000+ đánh giá) · Giao diện Admin UI (React/Vite/Tailwind) · Kiểm thử & Benchmark MongoDB.

## 1. Khởi động MongoDB
Mở **Docker Desktop** rồi chạy từ thư mục gốc `d:\webphim`:
```powershell
docker compose up -d mongodb
```
*(Tùy chọn: khởi chạy cả 3 DB khi tích hợp TV2 & TV3: `docker compose up -d`)*

## 2. Khởi tạo Schema, Index & Seed dữ liệu (chạy 2 lần không trùng)
```powershell
cd d:\webphim\backend
.\.venv\Scripts\python.exe scripts\init_mongo.py
.\.venv\Scripts\python.exe scripts\seed_mongo.py
# Chạy lại lần 2 để kiểm chứng idempotent (số lượng bản ghi giữ nguyên)
.\.venv\Scripts\python.exe scripts\seed_mongo.py
# Tải & cache toàn bộ poster phim về cục bộ (đảm bảo hiển thị nhanh và ổn định khi demo offline)
.\.venv\Scripts\python.exe scripts\cache_posters.py
```

**Tài khoản mẫu sau khi seed:**
- **Admin**: `admin@titofilm.local` / `Admin@123`
- **User**: `minh.anh@titofilm.local` / `User@123`

## 3. Chạy Backend FastAPI (Async)
```powershell
cd d:\webphim\backend
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```
- Swagger UI: http://localhost:8000/docs
- Health Check: http://localhost:8000/api/v1/health

## 4. Chạy Frontend Admin UI & Catalog (React + Vite + Tailwind)
```powershell
cd d:\webphim\frontend
npm run dev
```
- Giao diện Admin Studio: http://localhost:5173/admin
- Đăng nhập: http://localhost:5173/login
- Danh mục phim công khai: http://localhost:5173/catalog

## 5. Chạy Kiểm Thử Tự Động & Benchmark MongoDB
```powershell
cd d:\webphim\backend
# Unit & Integration Tests (RBAC, trùng email, rating không hợp lệ, chống NoSQL injection, $jsonSchema)
.\.venv\Scripts\pytest.exe -v

# Benchmark MongoDB: Index (IXSCAN / TEXT) vs COLLSCAN
.\.venv\Scripts\python.exe scripts\benchmark_mongo.py
```
Kết quả benchmark tự động xuất ra [docs/benchmark_mongodb.md](docs/benchmark_mongodb.md) và `docs/benchmark_mongodb.json`.
