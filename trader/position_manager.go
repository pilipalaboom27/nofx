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
// 新逻辑：
// - 触发：盈利 ≥ 保证金 × 触发百分比（默认5%）
// - 止损：回撤 ≥ (保证金 + 当前浮盈) × 回撤百分比（默认3%）
// ============================================================================

// TrailingStopState 移动止损状态
type TrailingStopState struct {
	Symbol          string    `json:"symbol"`
	Side            string    `json:"side"`
	EntryPrice      float64   `json:"entry_price"`
	Margin          float64   `json:"margin"`            // 保证金
	Leverage        int       `json:"leverage"`          // 杠杆
	InitialStopLoss float64   `json:"initial_stop_loss"` // 初始止损价（AI设定）
	CurrentStopLoss float64   `json:"current_stop_loss"` // 当前止损价
	PeakPrice       float64   `json:"peak_price"`        // 峰值价格（达到最高盈利时的价格）
	PeakProfit      float64   `json:"peak_profit"`       // 峰值盈利（USDT）
	TrailingActive  bool      `json:"trailing_active"`   // 是否已激活移动止损
	LastUpdated     time.Time `json:"last_updated"`
	UpdateCount     int       `json:"update_count"` // 更新次数

	// 兼容旧字段
	PeakPnLPct float64 `json:"peak_pnl_pct"` // 废弃，保留兼容
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
	pm.InitTrailingStopWithMargin(symbol, side, entryPrice, initialStopLoss, 0, 10)
}

// InitTrailingStopWithMargin 初始化移动止损状态（带保证金和杠杆）
func (pm *PositionManager) InitTrailingStopWithMargin(symbol, side string, entryPrice, initialStopLoss, margin float64, leverage int) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.trailingStops[symbol] = &TrailingStopState{
		Symbol:          symbol,
		Side:            side,
		EntryPrice:      entryPrice,
		Margin:          margin,
		Leverage:        leverage,
		InitialStopLoss: initialStopLoss,
		CurrentStopLoss: initialStopLoss,
		PeakPrice:       entryPrice,
		PeakProfit:      0,
		TrailingActive:  false,
		LastUpdated:     time.Now().UTC(),
		UpdateCount:     0,
	}
}

// UpdateTrailingStop 更新移动止损（新的保证金回撤模式）
// 触发条件：盈利 ≥ 保证金 × 触发百分比
// 止损条件：回撤 ≥ (保证金 + 当前浮盈) × 回撤百分比
// 返回：新的止损价格，是否需要更新，原因说明
func (pm *PositionManager) UpdateTrailingStop(
	symbol string,
	currentPrice float64,
	config *store.ConservativeStrategyConfig,
) (newStopLoss float64, shouldUpdate bool, reason string) {
	if !config.EnableTrailingStop {
		return 0, false, ""
	}

	// 使用默认值处理零值情况（兼容旧配置）
	triggerPct := config.TrailTriggerPct
	if triggerPct == 0 {
		triggerPct = 5.0 // 默认5%触发
	}
	drawdownPct := config.TrailDrawdownPct
	if drawdownPct == 0 {
		drawdownPct = 3.0 // 默认3%回撤
	}

	pm.mu.Lock()
	defer pm.mu.Unlock()

	state, exists := pm.trailingStops[symbol]
	if !exists {
		return 0, false, "未找到持仓状态"
	}

	// 计算当前盈利（USDT）
	// 盈利 = 价格变动% × 杠杆 × 保证金
	priceChangePct := pm.calculatePriceChangePct(state.EntryPrice, currentPrice, state.Side)
	currentProfit := state.Margin * float64(state.Leverage) * priceChangePct / 100

	// 更新峰值（始终更新，不管是否触发）
	if currentProfit > state.PeakProfit {
		state.PeakPrice = currentPrice
		state.PeakProfit = currentProfit
	}

	// 检查是否触发移动止损
	// 触发条件：盈利 ≥ 保证金 × 触发百分比
	triggerThreshold := state.Margin * triggerPct / 100

	if !state.TrailingActive {
		if currentProfit >= triggerThreshold {
			// 触发移动止损
			state.TrailingActive = true
			newStop := pm.calculateProfitBasedStop(state, currentPrice, currentProfit, drawdownPct)
			state.CurrentStopLoss = newStop
			state.LastUpdated = time.Now().UTC()
			state.UpdateCount++
			return newStop, true, fmt.Sprintf("触发移动止损：盈利%.2f USDT ≥ 保证金×%.0f%% (%.2f USDT)，止损价 %.4f",
				currentProfit, triggerPct, triggerThreshold, newStop)
		}
		return 0, false, fmt.Sprintf("盈利%.2f USDT < 触发阈值%.2f USDT (保证金×%.0f%%)", currentProfit, triggerThreshold, triggerPct)
	}

	// 已触发追踪，计算新的止损价格
	newStop := pm.calculateProfitBasedStop(state, currentPrice, currentProfit, drawdownPct)

	// 止损只能朝有利方向移动（做多只能上移，做空只能下移）
	if state.Side == "long" {
		if newStop <= state.CurrentStopLoss {
			return 0, false, "止损未提高"
		}
	} else {
		if newStop >= state.CurrentStopLoss {
			return 0, false, "止损未降低"
		}
	}

	// 更新止损
	oldStop := state.CurrentStopLoss
	state.CurrentStopLoss = newStop
	state.LastUpdated = time.Now().UTC()
	state.UpdateCount++

	return newStop, true, fmt.Sprintf("止损更新：%.4f → %.4f（峰值盈利%.2f USDT）", oldStop, newStop, state.PeakProfit)
}

// calculateProfitBasedStop 基于盈利的止损价格计算
// 当回撤达到 (保证金 + 当前浮盈) × 回撤百分比 时触发
func (pm *PositionManager) calculateProfitBasedStop(state *TrailingStopState, currentPrice, currentProfit, drawdownPct float64) float64 {
	// 止损阈值 = (保证金 + 峰值盈利) × 回撤百分比
	// 即：当盈利从峰值回撤这么多时，触发止损
	drawdownThreshold := (state.Margin + state.PeakProfit) * drawdownPct / 100

	// 峰值盈利 - 止损阈值 = 允许保留的最低盈利
	minProfit := state.PeakProfit - drawdownThreshold

	// 计算对应的止损价格
	// 盈利 = 保证金 × 杠杆 × 价格变动%
	// 价格变动% = 盈利 / (保证金 × 杠杆)
	if state.Margin == 0 || state.Leverage == 0 {
		return state.PeakPrice // 无法计算，返回峰值价
	}

	minPriceChangePct := minProfit / (state.Margin * float64(state.Leverage)) * 100

	var stopPrice float64
	if state.Side == "long" {
		// 做多：止损价 = 入场价 × (1 + 最低价格变动%)
		stopPrice = state.EntryPrice * (1 + minPriceChangePct/100)
	} else {
		// 做空：止损价 = 入场价 × (1 - 最低价格变动%)
		stopPrice = state.EntryPrice * (1 - minPriceChangePct/100)
	}

	return stopPrice
}

// calculatePriceChangePct 计算价格变动百分比（不含杠杆）
func (pm *PositionManager) calculatePriceChangePct(entryPrice, currentPrice float64, side string) float64 {
	if entryPrice == 0 {
		return 0
	}

	if side == "long" {
		return (currentPrice - entryPrice) / entryPrice * 100
	}
	return (entryPrice - currentPrice) / entryPrice * 100
}

// calculatePnLPct 计算盈利百分比（基于保证金，已废弃）
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

// CalculateTrailingStop 便捷函数：计算移动止损价格（废弃，保留兼容）
func CalculateTrailingStop(
	entryPrice float64,
	currentPrice float64,
	peakPrice float64,
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
	triggerPct := config.TrailTriggerPct
	if triggerPct == 0 {
		triggerPct = 5.0
	}
	if pnlPct < triggerPct {
		return 0, false
	}

	// 使用实际峰值价格计算止损
	drawdownPct := config.TrailDrawdownPct
	if drawdownPct == 0 {
		drawdownPct = 3.0
	}
	drawdown := drawdownPct / 100
	if side == "long" {
		newStopLoss = peakPrice * (1 - drawdown)
	} else {
		newStopLoss = peakPrice * (1 + drawdown)
	}

	return newStopLoss, true
}

// FormatStopLossPrice 格式化止损价格（根据价格精度）
// 使用保守的精度规则以避免 Binance API 精度错误
func FormatStopLossPrice(price float64, symbol string) float64 {
	// 根据价格大小决定精度（保守策略）
	// 大多数交易对使用以下精度：
	// - 价格 >= 10: 2位小数
	// - 价格 >= 1: 3位小数
	// - 价格 >= 0.1: 4位小数
	// - 价格 < 0.1: 5位小数
	if price >= 10 {
		return math.Round(price*100) / 100 // 2位小数
	} else if price >= 1 {
		return math.Round(price*1000) / 1000 // 3位小数
	} else if price >= 0.1 {
		return math.Round(price*10000) / 10000 // 4位小数
	}
	return math.Round(price*100000) / 100000 // 5位小数
}
