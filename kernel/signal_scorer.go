package kernel

import (
	"fmt"
	"math"
	"strings"

	"nofx/market"
	"nofx/store"
)

// ============================================================================
// Signal Scorer - 信号质量评分器
// ============================================================================
// 对交易信号进行综合评分，只接受高质量信号
// 评分维度：
// - RSI位置 (25分): 超卖区做多/超买区做空得分高
// - EMA趋势 (25分): 顺势交易得分高
// - 量价配合 (20分): OI与价格同向变化得分高
// - 多周期共振 (30分): 15M/1H/4H趋势一致得分高
// ============================================================================

// SignalScorer 信号评分器
type SignalScorer struct{}

// SignalScore 信号评分结果
type SignalScore struct {
	Total          int    `json:"total"`           // 总分 (0-100)
	RSIScore       int    `json:"rsi_score"`       // RSI得分 (0-25)
	EMAScore       int    `json:"ema_score"`       // EMA趋势得分 (0-25)
	VolumePriceScore int  `json:"volume_price_score"` // 量价配合得分 (0-20)
	MultiTFScore   int    `json:"multi_tf_score"`  // 多周期共振得分 (0-30)
	Details        string `json:"details"`        // 评分详情
}

// NewSignalScorer 创建信号评分器
func NewSignalScorer() *SignalScorer {
	return &SignalScorer{}
}

// Score 对交易决策进行评分
func (s *SignalScorer) Score(
	ctx *Context,
	decision *Decision,
	marketData *market.Data,
	multiTFData map[string]*market.TimeframeSeriesData,
	config *store.ConservativeStrategyConfig,
) *SignalScore {
	if decision == nil || marketData == nil {
		return &SignalScore{Total: 0, Details: "无法评分：缺少决策或市场数据"}
	}

	score := &SignalScore{}

	// 判断交易方向
	isLong := strings.Contains(strings.ToUpper(decision.Action), "LONG") ||
		decision.Action == "open_long" || decision.Action == "add_position"

	// 1. RSI位置评分 (25分)
	score.RSIScore = s.scoreRSI(marketData.CurrentRSI7, isLong)

	// 2. EMA趋势评分 (25分)
	score.EMAScore = s.scoreEMATrend(marketData, isLong)

	// 3. 量价配合评分 (20分)
	score.VolumePriceScore = s.scoreVolumePrice(marketData, isLong)

	// 4. 多周期共振评分 (30分)
	score.MultiTFScore = s.scoreMultiTimeframe(multiTFData, isLong)

	// 计算总分
	score.Total = score.RSIScore + score.EMAScore + score.VolumePriceScore + score.MultiTFScore

	// 生成详情
	score.Details = s.generateDetails(score, marketData.CurrentRSI7, isLong)

	return score
}

// scoreRSI RSI位置评分 (最高25分)
// 做多：RSI越低越好（超卖区买入更安全）
// 做空：RSI越高越好（超买区卖出更安全）
func (s *SignalScorer) scoreRSI(rsi float64, isLong bool) int {
	if rsi == 0 {
		return 0
	}

	if isLong {
		// 做多：RSI越低越好
		switch {
		case rsi < 25:
			return 25 // 极度超卖
		case rsi < 30:
			return 22 // 超卖区
		case rsi < 40:
			return 18 // 偏低
		case rsi < 50:
			return 12 // 中性偏弱
		case rsi < 60:
			return 8  // 中性偏强
		case rsi < 70:
			return 4  // 偏高
		default:
			return 0  // 超买区，不适合做多
		}
	} else {
		// 做空：RSI越高越好
		switch {
		case rsi > 75:
			return 25 // 极度超买
		case rsi > 70:
			return 22 // 超买区
		case rsi > 60:
			return 18 // 偏高
		case rsi > 50:
			return 12 // 中性偏强
		case rsi > 40:
			return 8  // 中性偏弱
		case rsi > 30:
			return 4  // 偏低
		default:
			return 0  // 超卖区，不适合做空
		}
	}
}

// scoreEMATrend EMA趋势评分 (最高25分)
// 做多：价格在EMA20上方且EMA呈多头排列得分高
// 做空：价格在EMA20下方且EMA呈空头排列得分高
func (s *SignalScorer) scoreEMATrend(data *market.Data, isLong bool) int {
	if data == nil || data.CurrentEMA20 == 0 {
		return 0
	}

	score := 0
	price := data.CurrentPrice
	ema20 := data.CurrentEMA20

	// 价格相对于EMA20的位置 (10分)
	if isLong {
		if price > ema20 {
			deviationPct := (price - ema20) / ema20 * 100
			if deviationPct < 3 {
				score += 10 // 价格刚站上EMA20
			} else if deviationPct < 5 {
				score += 7  // 价格适度高于EMA20
			} else {
				score += 3  // 价格偏离过大，可能追高
			}
		}
	} else {
		if price < ema20 {
			deviationPct := (ema20 - price) / ema20 * 100
			if deviationPct < 3 {
				score += 10 // 价格刚跌破EMA20
			} else if deviationPct < 5 {
				score += 7  // 价格适度低于EMA20
			} else {
				score += 3  // 价格偏离过大，可能追空
			}
		}
	}

	// 检查EMA序列（如果有多时间框架数据）
	if data.TimeframeData != nil {
		if primaryTF, ok := data.TimeframeData["5m"]; ok && len(primaryTF.EMA20Values) > 0 && len(primaryTF.EMA50Values) > 0 {
			ema20Last := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-1]
			ema50Last := primaryTF.EMA50Values[len(primaryTF.EMA50Values)-1]

			// EMA排列 (15分)
			if isLong {
				if ema20Last > ema50Last {
					score += 15 // 多头排列
				} else if ema20Last > ema50Last*0.98 {
					score += 8  // 接近金叉
				}
			} else {
				if ema20Last < ema50Last {
					score += 15 // 空头排列
				} else if ema20Last < ema50Last*1.02 {
					score += 8  // 接近死叉
				}
			}
		}
	}

	return score
}

// scoreVolumePrice 量价配合评分 (最高20分)
// OI增加+价格上涨 = 强多头
// OI增加+价格下跌 = 强空头
func (s *SignalScorer) scoreVolumePrice(data *market.Data, isLong bool) int {
	if data == nil || data.OpenInterest == nil {
		return 10 // 无数据时给中等分数
	}

	score := 0

	// 价格变化
	priceChange := data.PriceChange1h

	// OI变化（使用Latest相对于Average的变化估算）
	var oiChange float64
	if data.OpenInterest.Average > 0 {
		oiChange = (data.OpenInterest.Latest - data.OpenInterest.Average) / data.OpenInterest.Average * 100
	}

	// 量价配合判断
	if isLong {
		// 做多：希望看到OI增加+价格上涨
		if oiChange > 0 && priceChange > 0 {
			score = 20 // 完美配合：资金流入+价格上涨
		} else if oiChange > 0 && priceChange > -1 {
			score = 15 // OI增加，价格稳定
		} else if priceChange > 2 {
			score = 10 // 价格上涨但OI未增加（可能是空头平仓）
		} else {
			score = 5  // 量价不配合
		}
	} else {
		// 做空：希望看到OI增加+价格下跌
		if oiChange > 0 && priceChange < 0 {
			score = 20 // 完美配合：资金流入+价格下跌
		} else if oiChange > 0 && priceChange < 1 {
			score = 15 // OI增加，价格稳定
		} else if priceChange < -2 {
			score = 10 // 价格下跌但OI未增加（可能是多头平仓）
		} else {
			score = 5  // 量价不配合
		}
	}

	return score
}

// scoreMultiTimeframe 多周期共振评分 (最高30分)
// 检查15M/1H/4H趋势是否一致
func (s *SignalScorer) scoreMultiTimeframe(tfData map[string]*market.TimeframeSeriesData, isLong bool) int {
	if tfData == nil || len(tfData) == 0 {
		return 15 // 无数据时给中等分数
	}

	// 分析各时间框架趋势
	trends := make(map[string]string) // "up", "down", "sideways"

	for tf, data := range tfData {
		if len(data.EMA20Values) < 2 || len(data.EMA50Values) < 2 {
			continue
		}

		// 获取最近的EMA值
		ema20Last := data.EMA20Values[len(data.EMA20Values)-1]
		ema20Prev := data.EMA20Values[len(data.EMA20Values)-2]
		ema50Last := data.EMA50Values[len(data.EMA50Values)-1]

		// 判断趋势
		if ema20Last > ema50Last && ema20Last > ema20Prev {
			trends[tf] = "up"
		} else if ema20Last < ema50Last && ema20Last < ema20Prev {
			trends[tf] = "down"
		} else {
			trends[tf] = "sideways"
		}
	}

	// 计算共振程度
	upCount := 0
	downCount := 0

	for _, trend := range trends {
		if trend == "up" {
			upCount++
		} else if trend == "down" {
			downCount++
		}
	}

	totalTF := len(trends)
	if totalTF == 0 {
		return 15
	}

	score := 0

	if isLong {
		// 做多：希望多个时间框架显示上涨趋势
		if upCount == totalTF {
			score = 30 // 完美共振
		} else if upCount >= totalTF-1 {
			score = 25 // 几乎一致
		} else if upCount >= totalTF/2 {
			score = 18 // 多数一致
		} else if upCount > 0 {
			score = 10 // 少数一致
		} else {
			score = 0  // 完全逆向
		}
	} else {
		// 做空：希望多个时间框架显示下跌趋势
		if downCount == totalTF {
			score = 30 // 完美共振
		} else if downCount >= totalTF-1 {
			score = 25 // 几乎一致
		} else if downCount >= totalTF/2 {
			score = 18 // 多数一致
		} else if downCount > 0 {
			score = 10 // 少数一致
		} else {
			score = 0  // 完全逆向
		}
	}

	return score
}

// generateDetails 生成评分详情
func (s *SignalScorer) generateDetails(score *SignalScore, rsi float64, isLong bool) string {
	var details strings.Builder

	direction := "做多"
	if !isLong {
		direction = "做空"
	}

	details.WriteString(fmt.Sprintf("【%s信号评分】总分: %d/100\n", direction, score.Total))
	details.WriteString(fmt.Sprintf("• RSI位置: %d/25 (当前RSI: %.1f)\n", score.RSIScore, rsi))
	details.WriteString(fmt.Sprintf("• EMA趋势: %d/25\n", score.EMAScore))
	details.WriteString(fmt.Sprintf("• 量价配合: %d/20\n", score.VolumePriceScore))
	details.WriteString(fmt.Sprintf("• 多周期共振: %d/30\n", score.MultiTFScore))

	// 添加评价
	if score.Total >= 80 {
		details.WriteString("评价: 优质信号 ★★★")
	} else if score.Total >= 60 {
		details.WriteString("评价: 良好信号 ★★")
	} else if score.Total >= 40 {
		details.WriteString("评价: 一般信号 ★")
	} else {
		details.WriteString("评价: 弱信号 ⚠️")
	}

	return details.String()
}

// ValidateSignalScore 验证信号分数是否达到阈值
func ValidateSignalScore(score *SignalScore, minScore int) error {
	if score.Total < minScore {
		return fmt.Errorf("信号分数不足: %d < %d\n%s", score.Total, minScore, score.Details)
	}
	return nil
}

// CalculateSignalScore 便捷函数：计算信号分数
func CalculateSignalScore(
	ctx *Context,
	decision *Decision,
	config *store.ConservativeStrategyConfig,
) *SignalScore {
	scorer := NewSignalScorer()

	// 获取市场数据
	marketData := ctx.MarketDataMap[decision.Symbol]
	multiTFData := ctx.MultiTFMarket[decision.Symbol]

	if marketData == nil {
		return &SignalScore{
			Total:   0,
			Details: fmt.Sprintf("无法获取 %s 的市场数据", decision.Symbol),
		}
	}

	// 获取多时间框架数据
	// MultiTFMarket[symbol] 是 map[string]*market.Data (timeframe -> Data)
	// 每个market.Data有TimeframeData字段
	var tfData map[string]*market.TimeframeSeriesData
	if multiTFData != nil {
		tfData = make(map[string]*market.TimeframeSeriesData)
		for tf, data := range multiTFData {
			if data.TimeframeData != nil {
				// 提取该时间框架的数据
				if tfSeries, ok := data.TimeframeData[tf]; ok {
					tfData[tf] = tfSeries
				}
			}
		}
	}
	// 如果multiTFData为空或没有数据，使用主市场数据的TimeframeData
	if len(tfData) == 0 && marketData.TimeframeData != nil {
		tfData = marketData.TimeframeData
	}

	return scorer.Score(ctx, decision, marketData, tfData, config)
}

// GetSignalQualityLevel 获取信号质量等级
func GetSignalQualityLevel(score int) string {
	switch {
	case score >= 80:
		return "A" // 优质
	case score >= 60:
		return "B" // 良好
	case score >= 40:
		return "C" // 一般
	default:
		return "D" // 较差
	}
}

// NormalizeScore 归一化分数到0-100
func NormalizeScore(score int) int {
	return int(math.Min(100, math.Max(0, float64(score))))
}
