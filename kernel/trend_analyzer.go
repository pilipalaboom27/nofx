package kernel

import (
	"fmt"
	"strings"

	"nofx/market"
	"nofx/store"
)

// ============================================================================
// Trend Analyzer - 趋势分析器
// ============================================================================
// 分析市场趋势方向，验证交易是否顺势
// 趋势判断基于EMA排列和价格位置
// ============================================================================

// TrendDirection 趋势方向
type TrendDirection int

const (
	TrendUp      TrendDirection = iota // 上涨趋势
	TrendDown                          // 下跌趋势
	TrendSideways                      // 横盘震荡
)

// String 返回趋势方向的字符串表示
func (t TrendDirection) String() string {
	switch t {
	case TrendUp:
		return "UP"
	case TrendDown:
		return "DOWN"
	case TrendSideways:
		return "SIDEWAYS"
	default:
		return "UNKNOWN"
	}
}

// ChineseString 返回趋势方向的中文表示
func (t TrendDirection) ChineseString() string {
	switch t {
	case TrendUp:
		return "上涨"
	case TrendDown:
		return "下跌"
	case TrendSideways:
		return "横盘"
	default:
		return "未知"
	}
}

// TrendAnalysis 趋势分析结果
type TrendAnalysis struct {
	Direction       TrendDirection `json:"direction"`         // 趋势方向
	Strength        int            `json:"strength"`          // 趋势强度 (0-100)
	PrimaryTF       string         `json:"primary_tf"`        // 主时间框架
	ConfirmTF       string         `json:"confirm_tf"`        // 确认时间框架
	IsConfirmed     bool           `json:"is_confirmed"`      // 是否多周期确认
	EMAAlignment    string         `json:"ema_alignment"`     // EMA排列状态
	PricePosition   string         `json:"price_position"`    // 价格相对EMA位置
	Details         string         `json:"details"`           // 详细说明
}

// TrendAnalyzer 趋势分析器
type TrendAnalyzer struct{}

// NewTrendAnalyzer 创建趋势分析器
func NewTrendAnalyzer() *TrendAnalyzer {
	return &TrendAnalyzer{}
}

// Analyze 分析市场趋势
func (t *TrendAnalyzer) Analyze(marketData *market.Data, tfData map[string]*market.TimeframeSeriesData) *TrendAnalysis {
	if marketData == nil {
		return &TrendAnalysis{
			Direction:   TrendSideways,
			Strength:    0,
			Details:     "无市场数据",
		}
	}

	analysis := &TrendAnalysis{
		Direction:     TrendSideways,
		Strength:      50,
		PrimaryTF:     "5m",
		IsConfirmed:   false,
	}

	// 分析主时间框架趋势
	primaryTrend := t.analyzeTimeframeTrend(tfData, "5m")
	if primaryTrend == nil && marketData.TimeframeData != nil {
		// 如果5m数据不存在，尝试使用其他时间框架
		for tf := range marketData.TimeframeData {
			primaryTrend = t.analyzeTimeframeTrend(marketData.TimeframeData, tf)
			analysis.PrimaryTF = tf
			break
		}
	}

	if primaryTrend != nil {
		analysis.Direction = primaryTrend.Direction
		analysis.Strength = primaryTrend.Strength
		analysis.EMAAlignment = primaryTrend.EMAAlignment
		analysis.PricePosition = primaryTrend.PricePosition
	}

	// 检查更大时间框架确认
	if tfData != nil {
		analysis.IsConfirmed = t.checkMultiTimeframeConfirm(tfData, analysis.Direction)
	}

	// 生成详情
	analysis.Details = t.generateDetails(analysis)

	return analysis
}

// analyzeTimeframeTrend 分析单个时间框架的趋势
func (t *TrendAnalyzer) analyzeTimeframeTrend(tfData map[string]*market.TimeframeSeriesData, tf string) *TrendAnalysis {
	if tfData == nil {
		return nil
	}

	data, ok := tfData[tf]
	if !ok || len(data.EMA20Values) < 2 || len(data.EMA50Values) < 2 {
		return nil
	}

	analysis := &TrendAnalysis{
		PrimaryTF: tf,
	}

	// 获取EMA值
	ema20Last := data.EMA20Values[len(data.EMA20Values)-1]
	ema20Prev := data.EMA20Values[len(data.EMA20Values)-1]
	if len(data.EMA20Values) > 1 {
		ema20Prev = data.EMA20Values[len(data.EMA20Values)-2]
	}
	ema50Last := data.EMA50Values[len(data.EMA50Values)-1]

	// 获取价格
	var price float64
	if len(data.Klines) > 0 {
		price = data.Klines[len(data.Klines)-1].Close
	}

	// 判断EMA排列
	if ema20Last > ema50Last {
		analysis.EMAAlignment = "BULLISH" // 多头排列
		analysis.Direction = TrendUp
	} else if ema20Last < ema50Last {
		analysis.EMAAlignment = "BEARISH" // 空头排列
		analysis.Direction = TrendDown
	} else {
		analysis.EMAAlignment = "NEUTRAL"
		analysis.Direction = TrendSideways
	}

	// 判断价格位置
	if price > ema20Last {
		analysis.PricePosition = "ABOVE_EMA20"
	} else if price < ema20Last {
		analysis.PricePosition = "BELOW_EMA20"
	} else {
		analysis.PricePosition = "AT_EMA20"
	}

	// 计算趋势强度
	analysis.Strength = t.calculateTrendStrength(ema20Last, ema20Prev, ema50Last, price)

	return analysis
}

// calculateTrendStrength 计算趋势强度
func (t *TrendAnalyzer) calculateTrendStrength(ema20, ema20Prev, ema50, price float64) int {
	strength := 0

	// EMA20与EMA50的距离（发散程度）
	divergence := 0.0
	if ema50 != 0 {
		divergence = (ema20 - ema50) / ema50 * 100
	}

	// 根据发散程度计分
	absDivergence := divergence
	if divergence < 0 {
		absDivergence = -divergence
	}

	switch {
	case absDivergence > 2:
		strength += 40
	case absDivergence > 1:
		strength += 30
	case absDivergence > 0.5:
		strength += 20
	default:
		strength += 10
	}

	// EMA20的斜率（变化率）
	slope := 0.0
	if ema20Prev != 0 {
		slope = (ema20 - ema20Prev) / ema20Prev * 100
	}

	absSlope := slope
	if slope < 0 {
		absSlope = -slope
	}

	switch {
	case absSlope > 0.5:
		strength += 40
	case absSlope > 0.2:
		strength += 30
	case absSlope > 0.1:
		strength += 20
	default:
		strength += 10
	}

	// 价格相对EMA20的位置
	if price > ema20 {
		priceDeviation := (price - ema20) / ema20 * 100
		if priceDeviation > 1 {
			strength += 20
		} else if priceDeviation > 0.3 {
			strength += 15
		} else {
			strength += 10
		}
	} else if price < ema20 {
		priceDeviation := (ema20 - price) / ema20 * 100
		if priceDeviation > 1 {
			strength += 20
		} else if priceDeviation > 0.3 {
			strength += 15
		} else {
			strength += 10
		}
	} else {
		strength += 10
	}

	return strength
}

// checkMultiTimeframeConfirm 检查多周期确认
func (t *TrendAnalyzer) checkMultiTimeframeConfirm(tfData map[string]*market.TimeframeSeriesData, primaryDirection TrendDirection) bool {
	confirmCount := 0
	totalCount := 0

	// 检查15m和1h时间框架
	keyTimeframes := []string{"15m", "1h", "4h"}

	for _, tf := range keyTimeframes {
		data, ok := tfData[tf]
		if !ok || len(data.EMA20Values) < 2 || len(data.EMA50Values) < 2 {
			continue
		}

		totalCount++

		ema20Last := data.EMA20Values[len(data.EMA20Values)-1]
		ema50Last := data.EMA50Values[len(data.EMA50Values)-1]

		var tfDirection TrendDirection
		if ema20Last > ema50Last {
			tfDirection = TrendUp
		} else if ema20Last < ema50Last {
			tfDirection = TrendDown
		} else {
			tfDirection = TrendSideways
		}

		if tfDirection == primaryDirection {
			confirmCount++
		}
	}

	// 至少需要2个时间框架确认
	return totalCount >= 2 && confirmCount >= 2
}

// ValidateEntry 验证入场是否符合趋势
func (t *TrendAnalyzer) ValidateEntry(analysis *TrendAnalysis, action string, config *store.ConservativeStrategyConfig) error {
	if !config.EnableTrendConfirm {
		return nil
	}

	if analysis == nil {
		return fmt.Errorf("无法进行趋势分析")
	}

	// 判断交易方向
	isLong := strings.Contains(strings.ToUpper(action), "LONG") ||
		action == "open_long" || action == "add_position"
	isShort := strings.Contains(strings.ToUpper(action), "SHORT") ||
		action == "open_short"

	// 验证趋势一致性
	if isLong && analysis.Direction == TrendDown {
		return fmt.Errorf("逆势交易被拒绝：当前为%s趋势，不宜做多", analysis.Direction.ChineseString())
	}

	if isShort && analysis.Direction == TrendUp {
		return fmt.Errorf("逆势交易被拒绝：当前为%s趋势，不宜做空", analysis.Direction.ChineseString())
	}

	// 检查多周期确认
	if config.RequireMultiTimeframe && !analysis.IsConfirmed {
		return fmt.Errorf("多周期趋势未确认：当前%s趋势未得到更大时间框架支持", analysis.Direction.ChineseString())
	}

	// 检查趋势强度
	if analysis.Strength < 30 {
		return fmt.Errorf("趋势强度不足：当前趋势强度仅%d/100，建议观望", analysis.Strength)
	}

	return nil
}

// generateDetails 生成趋势分析详情
func (t *TrendAnalyzer) generateDetails(analysis *TrendAnalysis) string {
	var details strings.Builder

	details.WriteString(fmt.Sprintf("【趋势分析】\n"))
	details.WriteString(fmt.Sprintf("方向: %s (强度: %d/100)\n", analysis.Direction.ChineseString(), analysis.Strength))
	details.WriteString(fmt.Sprintf("EMA排列: %s\n", analysis.EMAAlignment))
	details.WriteString(fmt.Sprintf("价格位置: %s\n", analysis.PricePosition))

	if analysis.IsConfirmed {
		details.WriteString("多周期确认: ✓ 已确认\n")
	} else {
		details.WriteString("多周期确认: ✗ 未确认\n")
	}

	return details.String()
}

// AnalyzeTrend 便捷函数：分析市场趋势
func AnalyzeTrend(ctx *Context, symbol string) *TrendAnalysis {
	analyzer := NewTrendAnalyzer()

	marketData := ctx.MarketDataMap[symbol]
	var tfData map[string]*market.TimeframeSeriesData

	// MultiTFMarket[symbol] 是 map[string]*market.Data (timeframe -> Data)
	// 需要从每个market.Data中提取TimeframeData
	if ctx.MultiTFMarket != nil && ctx.MultiTFMarket[symbol] != nil {
		tfData = make(map[string]*market.TimeframeSeriesData)
		for tf, data := range ctx.MultiTFMarket[symbol] {
			if data.TimeframeData != nil {
				if tfSeries, ok := data.TimeframeData[tf]; ok {
					tfData[tf] = tfSeries
				}
			}
		}
	}
	// 如果没有从MultiTFMarket获取到数据，使用主市场数据的TimeframeData
	if len(tfData) == 0 && marketData != nil && marketData.TimeframeData != nil {
		tfData = marketData.TimeframeData
	}

	return analyzer.Analyze(marketData, tfData)
}

// ValidateTrendEntry 便捷函数：验证趋势入场
func ValidateTrendEntry(ctx *Context, symbol string, action string, config *store.ConservativeStrategyConfig) error {
	analyzer := NewTrendAnalyzer()
	analysis := AnalyzeTrend(ctx, symbol)
	return analyzer.ValidateEntry(analysis, action, config)
}

// GetTrendEmoji 获取趋势方向对应的emoji
func GetTrendEmoji(direction TrendDirection) string {
	switch direction {
	case TrendUp:
		return "📈"
	case TrendDown:
		return "📉"
	case TrendSideways:
		return "↔️"
	default:
		return "❓"
	}
}
