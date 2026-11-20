# Titofilm — Hướng Dẫn Bàn Giao & Tích Hợp Cho TV2 (Neo4j) & TV3 (Redis)

> **Trạng thái nhánh `main`**: TV1 (MongoDB Source of Truth + FastAPI Backend + Seed 2.270 phim + Admin UI + Giao diện Titofilm + Tito Concierge) đã hoàn thành, kiểm thử **14/14 PASSED** và merge sạch vào `main`.  
> **Repo GitHub**: `https://github.com/tuandatt1243-source/cinevault-webphim.git`

---

## 1. Khởi chạy dự án trong 3 phút (Dành cho cả TV2 & TV3)

### Bước 1: Clone repo và tạo nhánh riêng
```bash
git clone https://github.com/tuandatt1243-source/cinevault-webphim.git
cd cinevault-webphim

# TV2 tạo nhánh:
git checkout -b feature/neo4j-recommendation

# TV3 tạo nhánh:
git checkout -b feature/redis-cache
```

### Bước 2: Khởi động hạ tầng NoSQL (MongoDB + Neo4j + Redis)
```bash
cp .env.example .env
docker compose up -d
```
- **MongoDB**: `localhost:27017` (DB: `cinevault`)
- **Neo4j**: Browser `http://localhost:7474` · Bolt `bolt://localhost:7687` (`neo4j` / `cinevault_neo4j_pass`)
- **Redis**: `localhost:6379`

### Bước 3: Cài Backend & Seed dữ liệu thật (2.270 phim tới năm 2026)
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -e ".[dev]"
python scripts/init_mongo.py
python scripts/seed_mongo.py
# (Tùy chọn) Cache sẵn poster HD cục bộ để load siêu nhanh:
python scripts/cache_posters.py

# Chạy FastAPI Backend:
uvicorn app.main:app --reload --port 8000
```
- Sau khi seed xong, MongoDB đã có sẵn: **2.270 phim thật** (`1920–2026`), **221 user** (phân cụm theo 8 persona để Neo4j gợi ý chính xác!), **34.811 review**, **49.489 interaction**.
- **Tài khoản mẫu**:
  - **Admin**: `admin@titofilm.local` / `Admin@123`
  - **User**: `minh.anh@titofilm.local` / `User@123`
- **API Docs**: `http://127.0.0.1:8000/docs`

### Bước 4: Chạy Frontend
```bash
cd frontend
npm install
npm run dev
```
- Mở trình duyệt: `http://127.0.0.1:5173/catalog`

*(Lưu ý: Nếu muốn dùng chế độ AI Gemini trong nút **Tư vấn phim**, thêm `GEMINI_API_KEY=...` vào `backend/.env` cục bộ — **KHÔNG commit `.env` lên Git**. Nếu để trống, trợ lý vẫn chạy bình thường bằng chế độ `MongoDB RAG` cục bộ.)*

---

## 2. Hướng dẫn tích hợp dành riêng cho **TV2 — Neo4j (Graph Recommendation & Sync)**

### 2.1. Cách bắt sự kiện đồng bộ từ TV1 (đã có sẵn Hook trong `backend/app/core/hooks.py`)
Mọi thao tác CRUD phim, đăng ký user, viết/xóa review, tương tác (`WATCH`/`LIKE`/`WATCHLIST_ADD`) ở TV1 đều **tự động ghi vào collection `sync_jobs`** và gọi `sync_hooks.emit(...)` với:
- `entity_type`: `"movie" | "user" | "review" | "interaction"`
- `entity_id`: chuỗi 24 ký tự hex của MongoDB `ObjectId` *(bắt buộc dùng làm khóa chính `id` trên Node Neo4j!)*
- `action`: `"UPSERT" | "DELETE" | "RESTORE"`
- `payload`: dữ liệu cần đồng bộ (`title`, `release_year`, `genres`, `cast`, `directors`, `replace_relations`, `rating`...)

**TV2 chỉ cần tạo các file riêng của mình:**
- `backend/app/core/neo4j_db.py` (Async Neo4j driver)
- `backend/app/services/neo4j_sync_service.py` (Full sync từ MongoDB → Neo4j + `handle_event(job_doc)`)
- `backend/app/services/recommendation_service.py` (Cypher: Collaborative Filtering, Content-Based, Hybrid, Cold-Start, Similar Movies)
- `backend/app/routers/recommendations.py` (`/api/v1/recommendations/for-me`, `/api/v1/movies/{id}/similar`, `/api/v1/admin/sync/neo4j`)
- `backend/scripts/sync_neo4j.py` (chạy đồng bộ toàn bộ 2.270 phim + 221 user + 34.811 review sang Neo4j lần đầu)

**Đăng ký 2 dòng trong `backend/app/main.py` (khi khởi động app):**
```python
from app.core.hooks import sync_hooks
from app.services import neo4j_sync_service

# Trong lifespan():
sync_hooks.register_handler(neo4j_sync_service.handle_event)
```
> Nếu Neo4j tắt/lỗi, `SyncHookRegistry` tự bắt ngoại lệ, cập nhật `sync_jobs.status = "FAILED"` + `retry_count += 1` mà **không làm lỗi API MongoDB**.

### 2.2. Vị trí gắn giao diện sẵn cho TV2 (không cần thiết kế lại UI!)
- **Trang chủ** (`frontend/src/pages/CatalogPreviewPage.jsx`): Gọi API `/api/v1/recommendations/for-me` và truyền thẳng mảng phim vào component **`<MovieRow title="Gợi ý dành riêng cho bạn" movies={recommendedMovies} ... />`**.
- **Chi tiết phim** (`frontend/src/components/MovieDetailModal.jsx`): Truyền danh sách phim tương tự từ Neo4j vào prop **`similarMoviesSlot`** đã mở sẵn (dòng `230` của `MovieDetailModal.jsx`).

---

## 3. Hướng dẫn tích hợp dành riêng cho **TV3 — Redis (Cache, Trending, Recently Watched, Blacklist, Rate Limit)**

### 3.1. Cách cắm Redis Cache & JWT Blacklist vào TV1 (`backend/app/core/hooks.py`)
TV1 đã chuẩn hóa sẵn lớp trừu tượng **`CacheHookProvider`** và gọi sẵn tại tất cả endpoint đọc/ghi phim, xem chi tiết, đăng nhập & đăng xuất!

**TV3 chỉ cần tạo các file riêng:**
- `backend/app/core/redis_client.py` (Async `redis.asyncio` client)
- `backend/app/services/redis_cache_provider.py`: Subclass `CacheHookProvider` và implement đủ 7 phương thức:
  1. `get_json(key)` → trả về `(data, "HIT")` hoặc `(None, "MISS")` *(hoặc `(None, "BYPASS")` nếu Redis mất kết nối)*
  2. `set_json(key, value, ttl_seconds)`
  3. `invalidate_movie(movie_id)` *(xóa `movies:detail:{movie_id}`)*
  4. `invalidate_movie_lists()` *(xóa các key `movies:list:*`)*
  5. `record_movie_view(movie_id, user_id)` *(tăng điểm `ZINCRBY trending:movies` & `LPUSH/LTRIM recent:user:{user_id}`)*
  6. `is_token_blacklisted(jti)` *(kiểm tra `EXISTS blacklist:jti:{jti}`)*
  7. `blacklist_token(jti, expires_in_seconds)` *(lưu `SETEX blacklist:jti:{jti} ttl 1`)*
- `backend/app/routers/trending.py`:
  - `GET /api/v1/movies/trending` (đọc Sorted Set Redis + hydrate thông tin phim từ MongoDB)
  - `GET /api/v1/users/me/recently-watched` (đọc List/ZSet Redis của user)
  - `GET /api/v1/admin/monitor` (tình trạng MongoDB + Neo4j + Redis + tỷ lệ Cache Hit/Miss)
- Middleware Rate Limiting (Fixed/Sliding Window trên Redis cho `/auth/login`, `/reviews`, `/assistant/chat`).

**Đăng ký 1 dòng trong `backend/app/main.py` (trong `lifespan()`):**
```python
from app.core.hooks import set_cache_provider
from app.services.redis_cache_provider import RedisCacheProvider

set_cache_provider(RedisCacheProvider(redis_client))
```
> **Lưu ý quan trọng**: Mọi hàm gọi Redis phải bọc `try/except` trả về `BYPASS` khi Redis sập — để khi demo rút điện Redis, web vẫn chạy bình thường từ MongoDB!

### 3.2. Vị trí gắn giao diện sẵn cho TV3
- **Trang chủ** (`frontend/src/pages/CatalogPreviewPage.jsx`): Cắm 2 hàng **`<MovieRow title="Đang thịnh hành 24h" movies={trendingMovies} ... />`** và **`<MovieRow title="Tiếp tục xem gần đây" movies={recentMovies} ... />`**.
- Kiểm chứng cache thực tế: Mở DevTools → Network → kiểm tra header **`X-Cache: MISS`** ở lần gọi đầu và **`X-Cache: HIT`** ở lần gọi sau!

---

## 4. Quy tắc làm việc nhóm tránh xung đột Git (Zero Merge Conflict)

1. **Không sửa trực tiếp các file service cốt lõi của TV1** (`movie_service.py`, `review_service.py`, `auth_service.py`, `schemas.py`) trừ khi thống nhất trước trong nhóm — mọi điểm nối đã đi qua `app/core/hooks.py`.
2. Chỉ đụng vào **tối đa 3 điểm nối nhẹ** khi ghép nhánh:
   - `backend/app/main.py`: `app.include_router(...)` & đăng ký hook trong `lifespan()`.
   - `frontend/src/api/client.js`: thêm hàm gọi endpoint mới của TV2/TV3.
   - `frontend/src/pages/CatalogPreviewPage.jsx` / `MovieDetailModal.jsx`: gắn thêm `<MovieRow />` & `similarMoviesSlot`.
3. **Trước khi tạo Pull Request vào `main`**, chạy bộ test tự động đảm bảo không phá hỏng phần TV1:
   ```bash
   cd backend && pytest -v
   cd ../frontend && npm run build
   ```
4. Tham khảo chi tiết toàn bộ endpoint & schema tại:
   - [docs/api_contract.md](./api_contract.md)
   - [docs/mongodb_design.md](./mongodb_design.md)
   - [docs/benchmark_mongodb.md](./benchmark_mongodb.md)
