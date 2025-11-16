-- schema.sql

-- ----------------------------
-- 1. 用户表 (User Authentication)
-- ----------------------------
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    -- 推荐使用 Web Crypto API 的 Argon2/Scrypt 哈希后存储
    password_hash TEXT NOT NULL
);

-- ----------------------------
-- 2. 材料表 (Materials Database)
-- ----------------------------
CREATE TABLE IF NOT EXISTS materials (
    UID TEXT PRIMARY KEY NOT NULL, 
    unified_name TEXT NOT NULL,
    material_type TEXT,
    sub_category TEXT,
    alias TEXT,
    color TEXT,
    model_number TEXT,
    length_mm REAL,
    width_mm REAL,
    diameter_mm REAL,
    r2_image_key TEXT
);
