# Titofilm — API Contract & Integration Specification (TV1 ↔ TV2 ↔ TV3)

> **Phiên bản**: `1.0.0` · **Base URL**: `/api/v1` · **Nguồn dữ liệu gốc**: MongoDB (`cinevault`)  
> **Quy ước ID bắt buộc**: Toàn bộ MongoDB `ObjectId` được ép sang **chuỗi 24 ký tự hex** (`id: string`) khi trả qua API, đồng bộ sang Neo4j (TV2) và lưu key trên Redis (TV3).

---

## 1. Quy ước Chung (Auth, Headers, Errors)

- **Authentication**: `Authorization: Bearer <access_token>` (JWT `HS256`).
- **JWT Payload**:
  ```json
  {
    "sub": "67f1a2b3c4d5e6f7a8b9c0d1",
    "role": "admin | user",
    "jti": "uuid4hex",
    "iat": 1760000000,
    "exp": 1760086400
  }
  ```
- **Cache Header (cho TV3)**: Các endpoint đọc phim trả kèm header `X-Cache: HIT | MISS | BYPASS`.
- **Mã lỗi chuẩn**:
  - `400 Bad Request`: Sai định dạng ObjectId, phát hiện toán tử NoSQL injection (`$ne`, `$gt`, `$where`), hoặc Admin tự khóa/hạ quyền chính mình.
  - `401 Unauthorized`: Thiếu token, token hết hạn, token đã bị thu hồi (Redis blacklist), sai mật khẩu.
  - `403 Forbidden`: User thường truy cập endpoint Admin hoặc tài khoản bị khóa (`is_active: false`).
  - `404 Not Found`: Không tìm thấy bản ghi (hoặc phim đã xóa mềm đối với user thường).
  - `409 Conflict`: Trùng email khi đăng ký, trùng slug phim, hoặc thao tác trạng thái đã tồn tại.
  - `422 Unprocessable Entity`: Sai kiểu dữ liệu Pydantic (ví dụ `rating` không phải số nguyên `1..5`).

---

## 2. Danh sách API Cốt Lõi (TV1 Ownership)

### 2.1 Health
| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | Kiểm tra kết nối MongoDB (TV2/TV3 mở rộng thêm trạng thái Neo4j/Redis ở `/monitor`). |

### 2.2 Authentication (`/api/v1/auth`)
| Method | Endpoint | Auth | Status | Mô tả |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | `201` / `409` | Đăng ký user mới (`role="user"`), hash mật khẩu `bcrypt`, ghi job đồng bộ user vào `sync_jobs`. |
| `POST` | `/api/v1/auth/login` | Public | `200` / `401` / `403` | Đăng nhập, trả `{ access_token, token_type, expires_in, user }`. |
| `POST` | `/api/v1/auth/logout` | Bearer | `200` | Gọi `cache_provider.blacklist_token(jti, ttl)` (fail-safe nếu Redis tắt). |
| `GET` | `/api/v1/auth/me` | Bearer | `200` | Thông tin tài khoản hiện tại. |

### 2.3 Users & Watchlist (`/api/v1/users`)
| Method | Endpoint | Auth | Status | Mô tả |
|---|---|---|---|---|
| `PATCH` | `/api/v1/users/me` | Bearer | `200` | Cập nhật `full_name`, `avatar_url`, `bio`, `favorite_genres`. |
| `GET` | `/api/v1/users/me/watchlist` | Bearer | `200` | Danh sách phim trong watchlist (ẩn phim đã xóa mềm). |
| `POST` | `/api/v1/users/me/watchlist/{movie_id}` | Bearer | `201` | Thêm phim vào watchlist + tạo interaction `WATCHLIST_ADD`. |
| `DELETE` | `/api/v1/users/me/watchlist/{movie_id}` | Bearer | `200` | Gỡ phim khỏi watchlist. |

### 2.4 Movies (`/api/v1/movies`) — Hỗ trợ Soft Delete
| Method | Endpoint | Auth | Status | Mô tả |
|---|---|---|---|---|
| `GET` | `/api/v1/movies/genres` | Public | `200` | Danh sách thể loại & số lượng phim active (Aggregation `$unwind + $group`). |
| `GET` | `/api/v1/movies` | Public / Admin | `200` | Tìm kiếm (`q` dùng Text Index + safe regex fallback), lọc `genre`, `year`, `min_rating`, `sort` (`rating\|newest\|views\|created\|title\|year_asc`), `page`, `limit`. Admin hỗ trợ `status=active\|deleted\|all`. |
| `GET` | `/api/v1/movies/{movie_id}` | Public / Admin | `200` / `404` | Chi tiết phim; tự động tăng `views_count`, ghi interaction `VIEW` (nếu đã đăng nhập), gọi `record_movie_view` cho Redis Trending/Recently Watched. |
| `POST` | `/api/v1/movies` | **Admin** | `201` / `409` | Thêm phim mới + ghi `sync_jobs (UPSERT)` + invalidate cache. |
| `PUT` | `/api/v1/movies/{movie_id}` | **Admin** | `200` / `404` | Sửa phim + ghi `sync_jobs (UPSERT, replace_relations=true)` để TV2 xóa quan hệ cũ trên Neo4j + invalidate cache. |
| `DELETE` | `/api/v1/movies/{movie_id}` | **Admin** | `200` / `404` | **Soft Delete** (`is_deleted=true, deleted_at=now`) + ghi `sync_jobs (DELETE)` + invalidate cache. |
| `POST` | `/api/v1/movies/{movie_id}/restore` | **Admin** | `200` / `409` | **Khôi phục phim đã xóa mềm** (`is_deleted=false, deleted_at=null`) + ghi `sync_jobs (RESTORE)` + invalidate cache. |

### 2.5 Reviews & Interactions
| Method | Endpoint | Auth | Status | Mô tả |
|---|---|---|---|---|
| `GET` | `/api/v1/movies/{movie_id}/reviews` | Public / Admin | `200` | Danh sách đánh giá của phim (ẩn `is_hidden: true` với user thường). |
| `POST` | `/api/v1/movies/{movie_id}/reviews` | Bearer | `201` / `422` | Tạo/cập nhật đánh giá (`rating`: số nguyên nghiêm ngặt `1..5`, 1 review/user/movie), tự tính lại `avg_rating` & `rating_count` bằng Aggregation, ghi `sync_jobs (UPSERT)`. |
| `DELETE` | `/api/v1/reviews/{review_id}` | Owner / Admin | `200` / `403` | Xóa đánh giá, tính lại `avg_rating`, ghi `sync_jobs (DELETE)`. |
| `POST` | `/api/v1/interactions` | Bearer | `201` | Ghi nhận `VIEW | WATCH | LIKE | WATCHLIST_ADD`, ghi `sync_jobs (UPSERT)`. |

### 2.6 Admin Console (`/api/v1/admin`) — Chỉ `role == "admin"`
| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/admin/stats` | **Admin** | Thống kê toàn hệ thống (KPIs, phân bố 1–5★, Top 10 thể loại, Top 8 phim, phim theo thập kỷ, trạng thái `sync_jobs`, bình luận gần đây). |
| `GET` | `/api/v1/admin/users` | **Admin** | Danh sách user phân trang (kèm `review_count` & `watchlist_count`), lọc `q`, `role`, `is_active`. |
| `PATCH` | `/api/v1/admin/users/{user_id}` | **Admin** | Khóa/mở tài khoản (`is_active`), đổi phân quyền (`role`). Chặn admin tự khóa/hạ quyền mình (`400`). |
| `GET` | `/api/v1/admin/reviews` | **Admin** | Danh sách toàn bộ bình luận phục vụ kiểm duyệt (`q`, `rating`, `is_hidden`, `movie_id`). |
| `PATCH` | `/api/v1/admin/reviews/{review_id}/moderate` | **Admin** | Ẩn/hiện bình luận (`{ "is_hidden": true | false }`) và tự động cập nhật lại `avg_rating` của phim. |

---

## 3. Hợp Đồng Cắm Rút Cho TV2 (Neo4j) & TV3 (Redis)

### TV2 (`app/core/hooks.py` → `sync_hooks`)
- Mọi thao tác ghi ở TV1 đều tự động lưu bản ghi vào collection `sync_jobs` với cấu trúc:
  `{ job_type, entity_type, entity_id, action, status, retry_count, payload, error_message, created_at, updated_at }`.
- TV2 chỉ cần đăng ký handler bất đồng bộ khi app khởi động:
  ```python
  from app.core.hooks import sync_hooks
  sync_hooks.register_handler(neo4j_sync_service.handle_event)
  ```
- Nếu Neo4j lỗi hoặc đang tắt, `SyncHookRegistry` tự bắt exception, ghi `status: "FAILED"`, tăng `retry_count` và lưu `error_message` mà **không làm lỗi thao tác ghi MongoDB**.

### TV3 (`app/core/hooks.py` → `CacheHookProvider`)
- TV3 subclass `CacheHookProvider` (triển khai `get_json`, `set_json`, `invalidate_movie`, `invalidate_movie_lists`, `record_movie_view`, `is_token_blacklisted`, `blacklist_token`) và đăng ký bằng `set_cache_provider(redis_cache_provider)`.
- Khi Redis mất kết nối, mọi chỗ gọi ở TV1 đều có `try/except` fallback an toàn (`X-Cache: BYPASS` cho reads, fail-open có log warning cho blacklist) nên **API đọc phim và nghiệp vụ cốt lõi vẫn hoạt động bình thường**.
