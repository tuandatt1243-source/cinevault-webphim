# Tài Liệu Thiết Kế MongoDB & Bảo Mật Backend (TV1)

## 1. Tổng Quan Kiến Trúc Dữ Liệu
MongoDB đóng vai trò **Source of Truth (Kho dữ liệu gốc)** của hệ thống **Titofilm — Website quản lý phim tích hợp gợi ý phim cá nhân hóa**, chạy hoàn toàn **Async** trên FastAPI thông qua `pymongo.AsyncMongoClient`.

### 5 Collections Chính
1. **`users`**: Lưu hồ sơ tài khoản, mật khẩu hash `bcrypt` (12 rounds), phân quyền `role` (`user | admin`), trạng thái khóa `is_active`, sở thích `favorite_genres`, và mảng tham chiếu `watchlist: [ObjectId]`.
2. **`movies`**: Lưu thông tin tác phẩm điện ảnh thực tế (600+ phim từ tập IMDb Top 1000), nhúng trực tiếp các mảng hay đọc cùng nhau (`genres`, `cast`, `directors`) để tránh `$lookup` nặng, lưu các trường thống kê phi chuẩn hóa (`avg_rating`, `rating_count`, `views_count`) và hỗ trợ **Soft Delete** (`is_deleted`, `deleted_at`).
3. **`reviews`**: Lưu đánh giá sao (`rating: int 1..5`), nhận xét `comment`, trạng thái kiểm duyệt `is_hidden`. Ràng buộc duy nhất `(user_id, movie_id)` đảm bảo mỗi thành viên chỉ giữ 1 đánh giá hiện hành cho mỗi phim (hỗ trợ cập nhật upsert).
4. **`interactions`**: Ghi nhận hành vi người dùng (`VIEW`, `WATCH`, `LIKE`, `WATCHLIST_ADD`, `duration_sec`) phục vụ phân tích thống kê và đồng bộ quan hệ đồ thị sang Neo4j.
5. **`sync_jobs`**: Hàng đợi & nhật ký đồng bộ MongoDB → Neo4j (`SINGLE_EVENT` / `FULL_RESYNC`, trạng thái `PENDING | RUNNING | SUCCESS | FAILED`, `retry_count`, `error_message`) phục vụ retry, Resync (TV2) và NoSQL Monitor (TV3).

---

## 2. JSON Schema Validation (Server-Side)
Toàn bộ 5 collections đều được cấu hình `validationLevel: "strict"` và `validationAction: "error"` trong `backend/app/db/schemas.py` và khởi tạo idempotent qua `backend/scripts/init_mongo.py`:
- `users.email`: bắt buộc khớp regex email, kiểu `string`.
- `users.role`: chỉ nhận enum `["user", "admin"]`.
- `movies.release_year`: số nguyên `1888..2100`; `runtime_minutes`: số nguyên `1..1000`; `genres`: mảng không rỗng (`minItems: 1`).
- `reviews.rating`: **số nguyên `int` trong `[1..5]`** — chặn tuyệt đối rating `0`, `6`, số thực `4.5`, hoặc chuỗi kể cả khi chèn thẳng vào DB (đã kiểm chứng bằng test `WriteError 121`).
- `interactions.type`: enum `["VIEW", "WATCH", "LIKE", "WATCHLIST_ADD"]`.
- `sync_jobs.status`: enum `["PENDING", "RUNNING", "SUCCESS", "FAILED"]`.

---

## 3. Chiến Lược Index
| Collection | Tên Index | Loại | Định nghĩa | Mục đích |
|---|---|---|---|---|
| `users` | `uq_users_email` | Unique | `{ email: 1 }` | Chống trùng email, đăng nhập $O(\log N)$ |
| `users` | `idx_users_role_active_created` | Compound | `{ role: 1, is_active: 1, created_at: -1 }` | Lọc & quản trị user trong Admin UI |
| `movies` | `uq_movies_slug` | Unique | `{ slug: 1 }` | Chống trùng phim, bảo đảm seed idempotent |
| `movies` | `txt_movies_search` | Text | `title (10), original_title (8), cast (5), directors (4), overview (1)` | Full-text search phim có trọng số |
| `movies` | `idx_movies_active_genre_year_rating` | Compound | `{ is_deleted: 1, genres: 1, release_year: -1, avg_rating: -1 }` | Lọc phim theo thể loại + năm + sắp điểm |
| `movies` | `idx_movies_active_rating` | Compound | `{ is_deleted: 1, avg_rating: -1, rating_count: -1 }` | Bảng xếp hạng phim điểm cao |
| `movies` | `idx_movies_active_views` | Compound | `{ is_deleted: 1, views_count: -1 }` | Phim xem nhiều nhất |
| `movies` | `idx_movies_active_created` | Compound | `{ is_deleted: 1, created_at: -1 }` | Phim mới nhập kho |
| `reviews` | `uq_reviews_user_movie` | Unique Compound | `{ user_id: 1, movie_id: 1 }` | 1 review/user/phim, seed 2 lần không trùng |
| `reviews` | `idx_reviews_movie_visible_created` | Compound | `{ movie_id: 1, is_hidden: 1, created_at: -1 }` | Lấy bình luận công khai mới nhất của 1 phim |
| `reviews` | `idx_reviews_user_created` | Compound | `{ user_id: 1, created_at: -1 }` | Lịch sử đánh giá của thành viên |
| `reviews` | `idx_reviews_hidden_rating_created` | Compound | `{ is_hidden: 1, rating: 1, created_at: -1 }` | Màn hình kiểm duyệt bình luận Admin |
| `interactions` | `idx_interactions_user_type_created` | Compound | `{ user_id: 1, type: 1, created_at: -1 }` | Lịch sử xem/thích theo người dùng |
| `interactions` | `idx_interactions_movie_type_created` | Compound | `{ movie_id: 1, type: 1, created_at: -1 }` | Thống kê tương tác theo phim |
| `sync_jobs` | `idx_sync_jobs_status_created` | Compound | `{ status: 1, created_at: -1 }` | Giám sát job chờ/lỗi và Resync |

---

## 4. Các Aggregation Pipelines Trọng Tâm
1. **Cập nhật điểm trung bình phim** (`review_service.recalculate_movie_rating`): `$match { movie_id, is_hidden: false }` → `$group { avg_rating: $avg, rating_count: $sum }`.
2. **Phân bố điểm 1★–5★** (`admin_service._aggregate_rating_distribution`): `$match { is_hidden: false }` → `$group { _id: "$rating", count: { $sum: 1 } }`.
3. **Top thể loại** (`admin_service._aggregate_top_genres`): `$match { is_deleted: false }` → `$unwind "$genres"` → `$group` tính `movie_count`, `avg_rating`, `total_views` → `$sort` → `$limit 10`.
4. **Phim theo thập kỷ** (`admin_service._aggregate_movies_by_decade`): tính `floor(release_year / 10) * 10` → `$group` → `$sort`.
5. **Quản trị người dùng & bình luận** (`$lookup` + `$facet`): ghép thông tin user/movie và đếm tổng phân trang trong 1 round-trip.

---

## 5. Phòng Thủ Chống NoSQL Injection & Bảo Mật
- **Middleware kiểm tra payload & query string** (`app/main.py`): Chặn đệ quy mọi key bắt đầu bằng `$` hoặc chứa byte `\x00` trước khi vào router.
- **Pydantic v2 Strict Types** (`StrictStr`, `StrictInt`, `StrictBool`, `EmailStr`, `extra="forbid"`): Từ chối mọi đối tượng dict truyền thay cho chuỗi/số (ví dụ `{"email": {"$ne": null}}`).
- **Sanitization Regex & ObjectId** (`app/core/sanitize.py`): Mọi chuỗi ID đều kiểm tra `ObjectId.is_valid`, mọi fallback regex đều đi qua `re.escape()` + giới hạn độ dài để chống ReDoS, mọi tham số `sort` đi qua whitelist cố định.
- **RBAC & Chống tự khóa tài khoản**: Phụ thuộc `require_admin` tách biệt rõ `401` (chưa đăng nhập) và `403` (không đủ quyền / tài khoản bị khóa); chặn admin tự khóa hoặc tự hạ quyền chính mình.
