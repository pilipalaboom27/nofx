package trader

import (
	"fmt"
	"math"
	"sync"
	"time"

	"nofx/store"
)

// ============================================================================
// Position Manager - 持仓管理器
// ============================================================================
// 管理持仓的移动止损逻辑
// 盈利后自动移动止损锁定利润
// ============================================================================

// TrailingStopState 移动止损状态
type TrailingStopState struct {
	Symbol           string    `json:"symbol"`
	Side             string    `json:"side"`
	EntryPrice       float64   `json:"entry_price"`
	CurrentStopLoss  float64   `json:"current_stop_loss"`
	PeakPrice        float64   `json:"peak_price"`          // 峰值价格（用于计算最高盈利）
	PeakPnLPct       float64   `json:"peak_pnl_pct"`        // 峰值盈利百分比
	TrailingActive   bool      `json:"trailing_active"`     // 是否已激活移动止损
	LastUpdated      time.Time `json:"last_updated"`
	UpdateCount      int       `json:"update_count"`        // 更新次数
}

// PositionManager 持仓管理器
type PositionManager struct {
	mu            sync.RWMutex
	trailingStops map[string]*TrailingStopState // key: symbol
}

// NewPositionManager 创建持仓管理器
func NewPositionManager() *PositionManager {
	return &PositionManager{
		trailingStops: make(map[string]*TrailingStopState),
	}
}

// InitTrailingStop 初始化移动止损状态
func (pm *PositionManager) InitTrailingStop(symbol, side string, entryPrice, initialStopLoss float64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.trailingStops[symbol] = &TrailingStopState{
		Symbol:          symbol,
		Side:            side,
		EntryPrice:      entryPrice,
		CurrentStopLoss: initialStopLoss,
		PeakPrice:       entryPrice,
		PeakPnLPct:      0,
		TrailingActive:  false,
		LastUpdated:     time.Now().UTC(),
		UpdateCount:     0,
	}
}

// UpdateTrailingStop 更新移动止损
// 返回：新的止损价格，是否需要更新，错误信息
func (pm *PositionManager) UpdateTrailingStop(
	symbol string,
	currentPrice float64,
	config *store.ConservativeStrategyConfig,
) (newStopLoss float64, shouldUpdate bool, reason string) {
	if !config.EnableTrailingStop {
		return 0, false, ""
	}

	pm.mu.Lock()
	defer pm.mu.Unlock()

	state, exists := pm.trailingStops[symbol]
	if !exists {
		return 0, false, "未找到持仓状态"
	}

	// 计算当前盈利百分比
	pnlPct := pm.calculatePnLPct(state.EntryPrice, currentPrice, state.Side)

	// 更新峰值价格
	if pnlPct > state.PeakPnLPct {
		state.PeakPrice = currentPrice
		state.PeakPnLPct = pnlPct
	}

	// 检查是否触发移动止损
	if pnlPct < config.TrailAfterProfitPct {
		// 尚未达到触发阈值
		return 0, false, fmt.Sprintf("盈利%.2f%%未达到触发阈值%.2f%%", pnlPct, config.TrailAfterProfitPct)
	}

	// 激活移动止损
	state.TrailingActive = true

	// 计算新的止损价格
	var calculatedStopLoss float64

	if pnlPct >= config.TrailToBreakevenAt {
		// 盈利超过阈值，移至成本价
		calculatedStopLoss = state.EntryPrice
		reason = fmt.Sprintf("盈利%.2f%%达到%.2f%%阈值，止损移至成本价", pnlPct, config.TrailToBreakevenAt)
	} else {
		// 盈利未达到breakeven阈值，移动到盈利的一半位置
		trailPct := pnlPct * 0.5
		if state.Side == "long" {
			calculatedStopLoss = state.EntryPrice * (1 + trailPct/100)
		} else {
			calculatedStopLoss = state.EntryPrice * (1 - trailPct/100)
		}
		reason = fmt.Sprintf("盈利%.2f%%，止损移至+%.2f%%位置", pnlPct, trailPct)
	}

	// 只移动不回退（止损只能往盈利方向移动）
	if state.Side == "long" {
		if calculatedStopLoss <= state.CurrentStopLoss {
			return 0, false, "止损价格未改善（只能往盈利方向移动）"
		}
	} else {
		if calculatedStopLoss >= state.CurrentStopLoss && state.CurrentStopLoss > 0 {
			return 0, false, "止损价格未改善（只能往盈利方向移动）"
		}
	}

	// 添加缓冲区间（0.3%）避免假突破触发
	bufferPct := 0.3
	if state.Side == "long" {
		calculatedStopLoss = calculatedStopLoss * (1 - bufferPct/100)
	} else {
		calculatedStopLoss = calculatedStopLoss * (1 + bufferPct/100)
	}

	// 更新状态
	state.CurrentStopLoss = calculatedStopLoss
	state.LastUpdated = time.Now().UTC()
	state.UpdateCount++

	return calculatedStopLoss, true, reason
}

// calculatePnLPct 计算盈利百分比
func (pm *PositionManager) calculatePnLPct(entryPrice, currentPrice float64, side string) float64 {
	if entryPrice == 0 {
		return 0
	}

	if side == "long" {
		return (currentPrice - entryPrice) / entryPrice * 100
	}
	return (entryPrice - currentPrice) / entryPrice * 100
}

// GetTrailingStopState 获取移动止损状态
func (pm *PositionManager) GetTrailingStopState(symbol string) *TrailingStopState {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	if state, exists := pm.trailingStops[symbol]; exists {
		return state
	}
	return nil
}

// RemoveTrailingStop 移除移动止损状态（平仓时调用）
func (pm *PositionManager) RemoveTrailingStop(symbol string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	delete(pm.trailingStops, symbol)
}

// GetAllTrailingStops 获取所有移动止损状态
func (pm *PositionManager) GetAllTrailingStops() map[string]*TrailingStopState {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make(map[string]*TrailingStopState)
	for k, v := range pm.trailingStops {
		result[k] = v
	}
	return result
}

// CheckStopLossHit 检查是否触发止损
func (pm *PositionManager) CheckStopLossHit(symbol string, currentPrice float64) (hit bool, reason string) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	state, exists := pm.trailingStops[symbol]
	if !exists || state.CurrentStopLoss == 0 {
		return false, ""
	}

	if state.Side == "long" {
		if currentPrice <= state.CurrentStopLoss {
			return true, fmt.Sprintf("触发移动止损：当前价格%.4f <= 止损价%.4f", currentPrice, state.CurrentStopLoss)
		}
	} else {
		if currentPrice >= state.CurrentStopLoss {
			return true, fmt.Sprintf("触发移动止损：当前价格%.4f >= 止损价%.4f", currentPrice, state.CurrentStopLoss)
		}
	}

	return false, ""
}

// CalculateTrailingStop 便捷函数：计算移动止损价格
func CalculateTrailingStop(
	entryPrice float64,
	currentPrice float64,
	side string,
	config *store.ConservativeStrategyConfig,
) (newStopLoss float64, shouldUpdate bool) {
	if !config.EnableTrailingStop || entryPrice == 0 {
		return 0, false
	}

	// 计算盈利百分比
	var pnlPct float64
	if side == "long" {
		pnlPct = (currentPrice - entryPrice) / entryPrice * 100
	} else {
		pnlPct = (entryPrice - currentPrice) / entryPrice * 100
	}

	// 检查是否触发
	if pnlPct < config.TrailAfterProfitPct {
		return 0, false
	}

	// 计算新的止损价格
	if pnlPct >= config.TrailToBreakevenAt {
		// 移至成本价
		return entryPrice, true
	}

	// 移至盈利一半位置
	trailPct := pnlPct * 0.5
	if side == "long" {
		newStopLoss = entryPrice * (1 + trailPct/100)
	} else {
		newStopLoss = entryPrice * (1 - trailPct/100)
	}

	// 添加缓冲
	bufferPct := 0.3
	if side == "long" {
		newStopLoss = newStopLoss * (1 - bufferPct/100)
	} else {
		newStopLoss = newStopLoss * (1 + bufferPct/100)
	}

	return newStopLoss, true
}

// FormatStopLossPrice 格式化止损价格（根据价格精度）
func FormatStopLossPrice(price float64, symbol string) float64 {
	// 根据价格大小决定精度
	if price >= 1000 {
		return math.Round(price*100) / 100 // 2位小数
	} else if price >= 1 {
		return math.Round(price*1000) / 1000 // 3位小数
	} else if price >= 0.01 {
		return math.Round(price*10000) / 10000 // 4位小数
	}
	return math.Round(price*100000) / 100000 // 5位小数
}
