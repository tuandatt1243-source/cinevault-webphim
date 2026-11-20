# MongoDB Performance Benchmark — Index (IXSCAN / TEXT) vs COLLSCAN

Generated at: `2026-11-20T16:10:24.950445+00:00`

| Benchmark Case | Collection Size | Indexed Stage | Indexed Docs Examined | COLLSCAN Docs Examined | Indexed Avg (ms) | COLLSCAN Avg (ms) | Speedup |
|---|---:|---|---:|---:|---:|---:|---:|
| Movies Compound Filter (Drama, year>=2000, sort avg_rating) | 1,055 | `IXSCAN` | 20 | 1,055 | 1.218 | 1.776 | **1.46x** |
| Users Unique Email Lookup (Login) | 220 | `IXSCAN` | 1 | 220 | 0.467 | 0.538 | **1.15x** |
| Movies Full-Text Search ($text index vs $regex COLLSCAN) | 1,055 | `TEXT_MATCH` | 18 | 1,055 | 0.587 | 3.527 | **6.01x** |
| Reviews by Movie + Sort Newest (Seeded 6,000+ docs) | 14,835 | `IXSCAN` | 20 | 14,835 | 0.592 | 8.643 | **14.6x** |
| 50,000 Reviews Scale Test (movie_id + is_hidden + sort created_at) | 50,000 | `IXSCAN` | 20 | 50,000 | 0.569 | 22.732 | **39.95x** |
