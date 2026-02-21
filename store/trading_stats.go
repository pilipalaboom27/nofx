package store

import (
	"fmt"
	"sync"
	"time"
)

// ============================================================================
// Daily Trading Statistics - 日频交易统计
// ============================================================================
// 用于追踪每日交易次数和盈亏，支持保守策略的日频限制
// ============================================================================

// DailyTradingStats 每日交易统计
type DailyTradingStats struct {
	Date         string    `json:"date"`           // 日期 "2006-01-02"
	TradeCount   int       `json:"trade_count"`    // 当日交易次数
	RealizedPnL  float64   `json:"realized_pnl"`   // 当日已实现盈亏 (%)
	WinCount     int       `json:"win_count"`      // 盈利次数
	LossCount    int       `json:"loss_count"`     // 亏损次数
	LastUpdated  time.Time `json:"last_updated"`   // 最后更新时间
}

// TradingStatsStore 交易统计存储
type TradingStatsStore struct {
	mu       sync.RWMutex
	statsMap map[string]*DailyTradingStats // key: "userID_date"
}

// globalTradingStatsStore 全局交易统计存储实例
var globalTradingStatsStore = &TradingStatsStore{
	statsMap: make(map[string]*DailyTradingStats),
}

// GetTradingStatsStore 获取全局交易统计存储实例
func GetTradingStatsStore() *TradingStatsStore {
	return globalTradingStatsStore
}

// GetDailyStats 获取指定用户当日的交易统计
func (s *TradingStatsStore) GetDailyStats(userID string) *DailyTradingStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	today := time.Now().UTC().Format("2006-01-02")
	key := fmt.Sprintf("%s_%s", userID, today)

	if stats, ok := s.statsMap[key]; ok {
		return stats
	}

	// 返回新的统计对象
	return &DailyTradingStats{
		Date:        today,
		TradeCount:  0,
		RealizedPnL: 0,
		WinCount:    0,
		LossCount:   0,
		LastUpdated: time.Now().UTC(),
	}
}

// RecordTrade 记录一笔交易
func (s *TradingStatsStore) RecordTrade(userID string, pnlPct float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	today := time.Now().UTC().Format("2006-01-02")
	key := fmt.Sprintf("%s_%s", userID, today)

	stats, ok := s.statsMap[key]
	if !ok {
		stats = &DailyTradingStats{
			Date:        today,
			TradeCount:  0,
			RealizedPnL: 0,
			WinCount:    0,
			LossCount:   0,
		}
		s.statsMap[key] = stats
	}

	stats.TradeCount++
	stats.RealizedPnL += pnlPct
	if pnlPct > 0 {
		stats.WinCount++
	} else if pnlPct < 0 {
		stats.LossCount++
	}
	stats.LastUpdated = time.Now().UTC()
}

// IncrementTradeCount 只增加交易计数（用于开仓时）
func (s *TradingStatsStore) IncrementTradeCount(userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	today := time.Now().UTC().Format("2006-01-02")
	key := fmt.Sprintf("%s_%s", userID, today)

	stats, ok := s.statsMap[key]
	if !ok {
		stats = &DailyTradingStats{
			Date:        today,
			TradeCount:  0,
			RealizedPnL: 0,
			WinCount:    0,
			LossCount:   0,
		}
		s.statsMap[key] = stats
	}

	stats.TradeCount++
	stats.LastUpdated = time.Now().UTC()
}

// CanTrade 检查是否可以继续交易
func (s *TradingStatsStore) CanTrade(userID string, maxTrades int, maxLossPct float64) (bool, string) {
	stats := s.GetDailyStats(userID)

	if maxTrades > 0 && stats.TradeCount >= maxTrades {
		return false, fmt.Sprintf("日交易次数已达上限 (%d/%d)", stats.TradeCount, maxTrades)
	}

	if maxLossPct < 0 && stats.RealizedPnL <= maxLossPct {
		return false, fmt.Sprintf("日亏损已达上限 (%.2f%%/%.2f%%)", stats.RealizedPnL, maxLossPct)
	}

	return true, ""
}

// GetStatsSummary 获取统计摘要
func (s *TradingStatsStore) GetStatsSummary(userID string) string {
	stats := s.GetDailyStats(userID)

	winRate := 0.0
	if stats.TradeCount > 0 {
		winRate = float64(stats.WinCount) / float64(stats.TradeCount) * 100
	}

	return fmt.Sprintf("今日: %d 笔交易, 盈亏 %.2f%%, 胜率 %.1f%%",
		stats.TradeCount, stats.RealizedPnL, winRate)
}

// CleanupOldStats 清理过期统计（保留最近7天）
func (s *TradingStatsStore) CleanupOldStats() {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoff := time.Now().UTC().AddDate(0, 0, -7).Format("2006-01-02")

	for key, stats := range s.statsMap {
		if stats.Date < cutoff {
			delete(s.statsMap, key)
		}
	}
}

// ResetDailyStats 重置当日统计（用于测试或特殊情况）
func (s *TradingStatsStore) ResetDailyStats(userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	today := time.Now().UTC().Format("2006-01-02")
	key := fmt.Sprintf("%s_%s", userID, today)

	delete(s.statsMap, key)
}

// GetAllDailyStats 获取所有用户的当日统计（用于监控）
func (s *TradingStatsStore) GetAllDailyStats() map[string]*DailyTradingStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	today := time.Now().UTC().Format("2006-01-02")
	result := make(map[string]*DailyTradingStats)

	for key, stats := range s.statsMap {
		if stats.Date == today {
			result[key] = stats
		}
	}

	return result
}
