# Titofilm — Website Quản Lý Phim Tích Hợp Gợi Ý Phim Cá Nhân Hóa

Hệ thống quản lý phim và gợi ý phim cá nhân hóa theo kiến trúc **Polyglot NoSQL**:
- **MongoDB (TV1 — Source of Truth)**: Lưu trữ `movies`, `users`, `reviews`, `interactions`, `sync_jobs` với `$jsonSchema` Validation, Unique/Text/Compound Indexes và Aggregation Pipelines.
- **Neo4j (TV2 — Recommendation Graph)**: Đồ thị quan hệ `User`, `Movie`, `Genre`, `Actor`, `Director` phục vụ Collaborative Filtering, Content-Based & Hybrid Recommendation, đồng bộ từ MongoDB qua `sync_hooks` và `sync_jobs`.
- **Redis (TV3 — Cache & Realtime)**: Cache-Aside (`X-Cache: HIT/MISS/BYPASS`), Trending, Recently Watched, Rate Limit và JWT Blacklist (hỗ trợ fail-safe khi Redis ngắt kết nối).

---

## Cấu trúc Nhánh Git (Quy ước nhóm)
- `main`: Nhánh ổn định đã qua cổng nghiệm thu.
- `feature/mongodb-core` *(TV1)*: MongoDB, Backend FastAPI Async, Auth/RBAC, CRUD Phim (Soft Delete), Admin UI, Seed & Benchmark MongoDB.
- `feature/neo4j-recommendation` *(TV2)*: Neo4j Graph, `sync_service.py`, thuật toán gợi ý & trang Chi tiết phim.
- `feature/redis-frontend` *(TV3)*: Docker Compose hoàn chỉnh, Redis Cache/Blacklist/Rate Limit, User UI & NoSQL Monitor.

---

## Khởi chạy nhanh trên Windows

### 1. Chuẩn bị biến môi trường & Database
```powershell
Copy-Item .env.example .env
docker compose up -d mongodb
```
*(Chạy cả 3 DB khi tích hợp TV2 & TV3: `docker compose up -d`)*

### 2. Khởi tạo Schema/Index, Seed dữ liệu thực tế & Cache Poster
```powershell
cd backend
.\.venv\Scripts\python.exe scripts\init_mongo.py
.\.venv\Scripts\python.exe scripts\seed_mongo.py
# Chạy lại lần 2 để xác nhận idempotent (không trùng lặp)
.\.venv\Scripts\python.exe scripts\seed_mongo.py
# Tải & cache poster phim cục bộ
.\.venv\Scripts\python.exe scripts\cache_posters.py
```

**Tài khoản mẫu sau khi seed:**
- **Admin**: `admin@titofilm.local` / `Admin@123`
- **User**: `minh.anh@titofilm.local` / `User@123`

### 3. Chạy Backend (FastAPI Async) & Frontend (React + Vite + Tailwind)
```powershell
# Terminal 1 — Backend (http://127.0.0.1:8000/docs)
cd backend
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000

# Terminal 2 — Frontend (http://127.0.0.1:5173)
cd frontend
npm install
npm run dev
```

### 4. Kiểm thử & Benchmark MongoDB (TV1)
```powershell
cd backend
.\.venv\Scripts\pytest.exe -v
.\.venv\Scripts\python.exe scripts\benchmark_mongo.py
```

---

## Tài liệu kỹ thuật cho TV2 & TV3
- Hợp đồng API & Hook cắm rút (`sync_hooks`, `CacheHookProvider`): [docs/api_contract.md](docs/api_contract.md)
- Thiết kế MongoDB, Schema Validation & Indexes: [docs/mongodb_design.md](docs/mongodb_design.md)
- Báo cáo Benchmark Index vs COLLSCAN: [docs/benchmark_mongodb.md](docs/benchmark_mongodb.md)
- Hướng dẫn chi tiết TV1: [README_TV1.md](README_TV1.md)
