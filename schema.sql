-- ── LUDO GAME REWARD SYSTEM SCHEMA ─────────────────────────────
-- This script creates all necessary tables for the reward system.
-- Run this in your PostgreSQL tool (pgAdmin, psql, or similar).

-- 1. User Profiles (Extends basic auth)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(100),
    avatar_url TEXT,
    gems_balance INTEGER DEFAULT 0 NOT NULL CHECK (gems_balance >= 0),
    experience_points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Gem Transactions (History)
CREATE TABLE IF NOT EXISTS gem_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES user_profiles(user_id),
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'reward', 'spend'
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Gem Packages (Store items)
CREATE TABLE IF NOT EXISTS gem_packages (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    gems_amount INTEGER NOT NULL,
    bonus_gems INTEGER DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- 4. Daily Rewards (Streak tracking)
CREATE TABLE IF NOT EXISTS daily_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES user_profiles(user_id) UNIQUE,
    streak_days INTEGER DEFAULT 0,
    last_claimed_date DATE,
    total_claimed INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Achievements (Master list)
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    reward_gems INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    max_progress INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. User Achievements (Player progress)
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES user_profiles(user_id),
    achievement_id UUID REFERENCES achievements(id),
    current_progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    claimed_reward BOOLEAN DEFAULT false,
    UNIQUE(user_id, achievement_id)
);
