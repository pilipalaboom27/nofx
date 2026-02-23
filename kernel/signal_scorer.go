package kernel

import (
	"fmt"
	"math"
	"strings"

	"nofx/market"
	"nofx/store"
)

// ============================================================================
// Signal Scorer - 信号质量评分器（增强版）
// ============================================================================
// 对交易信号进行综合评分，只接受高质量信号
// 评分维度（总分100）：
// - RSI信号 (25分): RSI位置(15) + RSI趋势(5) + RSI背离(5)
// - EMA趋势 (25分): 价格位置(8) + EMA排列(9) + EMA斜率(8)
// - 量价配合 (20分): OI+价格(10) + 成交量(5) + 量价背离(5)
// - 多周期共振 (30分): 短周期(8) + 中周期(10) + 长周期(12)
// ============================================================================

// SignalScorer 信号评分器
type SignalScorer struct{}

// SignalScore 信号评分结果
type SignalScore struct {
	Total            int    `json:"total"`             // 总分 (0-100)
	RSIScore         int    `json:"rsi_score"`         // RSI得分 (0-25)
	EMAScore         int    `json:"ema_score"`         // EMA趋势得分 (0-25)
	VolumePriceScore int    `json:"volume_price_score"` // 量价配合得分 (0-20)
	MultiTFScore     int    `json:"multi_tf_score"`    // 多周期共振得分 (0-30)
	Details          string `json:"details"`          // 评分详情

	// 详细评分子项
	RSISubScore    *RSISubScore    `json:"rsi_sub_score,omitempty"`
	EMASubScore    *EMASubScore    `json:"ema_sub_score,omitempty"`
	VolumeSubScore *VolumeSubScore `json:"volume_sub_score,omitempty"`
	MultiTFSubScore *MultiTFSubScore `json:"multi_tf_sub_score,omitempty"`
}

// RSISubScore RSI子项评分
type RSISubScore struct {
	PositionScore int     `json:"position_score"` // RSI位置得分 (0-15)
	TrendScore    int     `json:"trend_score"`    // RSI趋势得分 (0-5)
	DivergeScore  int     `json:"diverge_score"`  // RSI背离得分 (0-5)
	RSIValue      float64 `json:"rsi_value"`      // 当前RSI值
	RSITrend      string  `json:"rsi_trend"`      // RSI趋势: "up", "down", "sideways"
	HasDivergence bool    `json:"has_divergence"` // 是否有背离
}

// EMASubScore EMA子项评分
type EMASubScore struct {
	PricePosScore  int     `json:"price_pos_score"`  // 价格位置得分 (0-8)
	AlignmentScore int     `json:"alignment_score"`  // EMA排列得分 (0-9)
	SlopeScore     int     `json:"slope_score"`      // EMA斜率得分 (0-8)
	PriceVsEMA20   float64 `json:"price_vs_ema20"`   // 价格与EMA20偏离%
	EMAAlignment   string  `json:"ema_alignment"`    // EMA排列状态
	EMASlope       string  `json:"ema_slope"`        // EMA斜率方向
}

// VolumeSubScore 量价子项评分
type VolumeSubScore struct {
	OIPriceScore   int     `json:"oi_price_score"`   // OI+价格得分 (0-10)
	VolumeScore    int     `json:"volume_score"`     // 成交量得分 (0-5)
	DivergeScore   int     `json:"diverge_score"`    // 量价背离得分 (0-5)
	OIChange       float64 `json:"oi_change"`        // OI变化%
	VolumeRatio    float64 `json:"volume_ratio"`     // 成交量比率
	HasDivergence  bool    `json:"has_divergence"`   // 是否有量价背离
}

// MultiTFSubScore 多周期子项评分
type MultiTFSubScore struct {
	ShortTFScore int               `json:"short_tf_score"` // 短周期得分 (0-8)
	MidTFScore   int               `json:"mid_tf_score"`   // 中周期得分 (0-10)
	LongTFScore  int               `json:"long_tf_score"`  // 长周期得分 (0-12)
	TFTrends     map[string]string `json:"tf_trends"`      // 各周期趋势
	TFAlignment  string            `json:"tf_alignment"`   // 整体排列状态
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

	score := &SignalScore{
		RSISubScore:    &RSISubScore{},
		EMASubScore:    &EMASubScore{},
		VolumeSubScore: &VolumeSubScore{},
		MultiTFSubScore: &MultiTFSubScore{
			TFTrends: make(map[string]string),
		},
	}

	// 判断交易方向
	isLong := strings.Contains(strings.ToUpper(decision.Action), "LONG") ||
		decision.Action == "open_long" || decision.Action == "add_position"

	// 1. RSI信号评分 (25分)
	score.RSIScore, score.RSISubScore = s.scoreRSIEnhanced(marketData, isLong)

	// 2. EMA趋势评分 (25分)
	score.EMAScore, score.EMASubScore = s.scoreEMAEnhanced(marketData, isLong)

	// 3. 量价配合评分 (20分)
	score.VolumePriceScore, score.VolumeSubScore = s.scoreVolumePriceEnhanced(marketData, isLong)

	// 4. 多周期共振评分 (30分)
	score.MultiTFScore, score.MultiTFSubScore = s.scoreMultiTimeframeEnhanced(multiTFData, marketData, isLong)

	// 计算总分
	score.Total = score.RSIScore + score.EMAScore + score.VolumePriceScore + score.MultiTFScore

	// 生成详情
	score.Details = s.generateDetailsEnhanced(score, isLong)

	return score
}

// scoreRSIEnhanced RSI增强评分 (最高25分)
// = RSI位置(15) + RSI趋势(5) + RSI背离(5)
func (s *SignalScorer) scoreRSIEnhanced(data *market.Data, isLong bool) (int, *RSISubScore) {
	sub := &RSISubScore{}
	totalScore := 0

	rsi := data.CurrentRSI7
	if rsi == 0 {
		sub.RSIValue = 0
		return 0, sub
	}
	sub.RSIValue = rsi

	// === 1. RSI位置评分 (15分) ===
	if isLong {
		// 做多：RSI越低越好（在超卖区买入更安全）
		switch {
		case rsi < 20:
			sub.PositionScore = 15 // 极度超卖
		case rsi < 25:
			sub.PositionScore = 13 // 深度超卖
		case rsi < 30:
			sub.PositionScore = 11 // 超卖区
		case rsi < 35:
			sub.PositionScore = 9  // 偏低
		case rsi < 45:
			sub.PositionScore = 7  // 中性偏弱
		case rsi < 55:
			sub.PositionScore = 5  // 中性
		case rsi < 65:
			sub.PositionScore = 3  // 中性偏强
		case rsi < 70:
			sub.PositionScore = 1  // 偏高
		default:
			sub.PositionScore = 0  // 超买区，不适合做多
		}
	} else {
		// 做空：RSI越高越好（在超买区卖出更安全）
		switch {
		case rsi > 80:
			sub.PositionScore = 15 // 极度超买
		case rsi > 75:
			sub.PositionScore = 13 // 深度超买
		case rsi > 70:
			sub.PositionScore = 11 // 超买区
		case rsi > 65:
			sub.PositionScore = 9  // 偏高
		case rsi > 55:
			sub.PositionScore = 7  // 中性偏强
		case rsi > 45:
			sub.PositionScore = 5  // 中性
		case rsi > 35:
			sub.PositionScore = 3  // 中性偏弱
		case rsi > 30:
			sub.PositionScore = 1  // 偏低
		default:
			sub.PositionScore = 0  // 超卖区，不适合做空
		}
	}
	totalScore += sub.PositionScore

	// === 2. RSI趋势评分 (5分) ===
	// 检查RSI是否有趋势数据
	if data.TimeframeData != nil {
		if tf, ok := data.TimeframeData["5m"]; ok && len(tf.RSI7Values) >= 3 {
			rsiCurrent := tf.RSI7Values[len(tf.RSI7Values)-1]
			rsiPrev := tf.RSI7Values[len(tf.RSI7Values)-2]
			rsiPrev2 := tf.RSI7Values[len(tf.RSI7Values)-3]

			// 判断RSI趋势
			if rsiCurrent > rsiPrev && rsiPrev > rsiPrev2 {
				sub.RSITrend = "up"
				if isLong {
					sub.TrendScore = 5 // 做多时RSI向上是好信号
				} else {
					sub.TrendScore = 2 // 做空时RSI向上不太好
				}
			} else if rsiCurrent < rsiPrev && rsiPrev < rsiPrev2 {
				sub.RSITrend = "down"
				if isLong {
					sub.TrendScore = 2 // 做多时RSI向下不太好
				} else {
					sub.TrendScore = 5 // 做空时RSI向下是好信号
				}
			} else {
				sub.RSITrend = "sideways"
				sub.TrendScore = 3 // 横盘给中等分
			}
		}
	}
	if sub.TrendScore == 0 {
		sub.TrendScore = 3 // 无数据时给中等分
	}
	totalScore += sub.TrendScore

	// === 3. RSI背离评分 (5分) ===
	// 背离检测需要更多K线数据
	if data.TimeframeData != nil {
		if tf, ok := data.TimeframeData["5m"]; ok && len(tf.RSI7Values) >= 10 && len(tf.Klines) >= 10 {
			// 提取收盘价
			closePrices := make([]float64, len(tf.Klines))
			for i, k := range tf.Klines {
				closePrices[i] = k.Close
			}
			sub.HasDivergence, sub.DivergeScore = s.detectRSIDivergence(closePrices, tf.RSI7Values, isLong)
		}
	}
	if sub.DivergeScore == 0 {
		sub.DivergeScore = 2 // 无背离数据时给基础分
	}
	totalScore += sub.DivergeScore

	return totalScore, sub
}

// detectRSIDivergence 检测RSI背离
// 看涨背离：价格创新低，RSI未创新低（做空时减分）
// 看跌背离：价格创新高，RSI未创新高（做多时减分）
func (s *SignalScorer) detectRSIDivergence(prices, rsiValues []float64, isLong bool) (bool, int) {
	if len(prices) < 10 || len(rsiValues) < 10 {
		return false, 2
	}

	// 取最近10根K线
	recentPrices := prices[len(prices)-10:]
	recentRSI := rsiValues[len(rsiValues)-10:]

	// 找到当前低点和高点
	currentPrice := recentPrices[len(recentPrices)-1]
	currentRSI := recentRSI[len(recentRSI)-1]

	// 找之前的价格低点和高点（前5-9根K线）
	prevLowPrice := math.MaxFloat64
	prevHighPrice := 0.0
	prevLowRSI := 100.0
	prevHighRSI := 0.0

	for i := 0; i < len(recentPrices)-3; i++ {
		if recentPrices[i] < prevLowPrice {
			prevLowPrice = recentPrices[i]
			prevLowRSI = recentRSI[i]
		}
		if recentPrices[i] > prevHighPrice {
			prevHighPrice = recentPrices[i]
			prevHighRSI = recentRSI[i]
		}
	}

	// 检测看涨背离（价格新低，RSI未新低）
	bullishDivergence := currentPrice < prevLowPrice && currentRSI > prevLowRSI

	// 检测看跌背离（价格新高，RSI未新高）
	bearishDivergence := currentPrice > prevHighPrice && currentRSI < prevHighRSI

	if isLong {
		// 做多时
		if bullishDivergence {
			// 看涨背离是好事
			return true, 5
		} else if bearishDivergence {
			// 看跌背离是坏事
			return true, 0
		}
	} else {
		// 做空时
		if bearishDivergence {
			// 看跌背离是好事
			return true, 5
		} else if bullishDivergence {
			// 看涨背离是坏事
			return true, 0
		}
	}

	return false, 3 // 无背离，给中等分
}

// scoreEMAEnhanced EMA增强评分 (最高25分)
// = 价格位置(8) + EMA排列(9) + EMA斜率(8)
func (s *SignalScorer) scoreEMAEnhanced(data *market.Data, isLong bool) (int, *EMASubScore) {
	sub := &EMASubScore{}
	totalScore := 0

	if data == nil || data.CurrentEMA20 == 0 {
		return 0, sub
	}

	price := data.CurrentPrice
	ema20 := data.CurrentEMA20

	// === 1. 价格与EMA20位置评分 (8分) ===
	if isLong {
		if price > ema20 {
			deviationPct := (price - ema20) / ema20 * 100
			sub.PriceVsEMA20 = deviationPct
			switch {
			case deviationPct < 1:
				sub.PricePosScore = 8  // 刚站上EMA20
			case deviationPct < 2:
				sub.PricePosScore = 7  // 适度
			case deviationPct < 3:
				sub.PricePosScore = 5  // 略高
			case deviationPct < 5:
				sub.PricePosScore = 3  // 偏高
			default:
				sub.PricePosScore = 1  // 追高风险
			}
		} else {
			sub.PriceVsEMA20 = (price - ema20) / ema20 * 100
			sub.PricePosScore = 0 // 价格在EMA20下方
		}
	} else {
		if price < ema20 {
			deviationPct := (ema20 - price) / ema20 * 100
			sub.PriceVsEMA20 = -deviationPct
			switch {
			case deviationPct < 1:
				sub.PricePosScore = 8  // 刚跌破EMA20
			case deviationPct < 2:
				sub.PricePosScore = 7  // 适度
			case deviationPct < 3:
				sub.PricePosScore = 5  // 略低
			case deviationPct < 5:
				sub.PricePosScore = 3  // 偏低
			default:
				sub.PricePosScore = 1  // 追空风险
			}
		} else {
			sub.PriceVsEMA20 = (price - ema20) / ema20 * 100
			sub.PricePosScore = 0 // 价格在EMA20上方
		}
	}
	totalScore += sub.PricePosScore

	// === 2. EMA排列评分 (9分) ===
	// 检查EMA序列
	if data.TimeframeData != nil {
		tfKey := "5m"
		if tf, ok := data.TimeframeData[tfKey]; ok && len(tf.EMA20Values) > 0 && len(tf.EMA50Values) > 0 {
			ema20Last := tf.EMA20Values[len(tf.EMA20Values)-1]
			ema50Last := tf.EMA50Values[len(tf.EMA50Values)-1]

			if isLong {
				// 做多：希望多头排列 (EMA20 > EMA50)
				if ema20Last > ema50Last {
					// 计算EMA20与EMA50的距离
					emaGap := (ema20Last - ema50Last) / ema50Last * 100
					switch {
					case emaGap > 2:
						sub.AlignmentScore = 9  // 明显多头排列
						sub.EMAAlignment = "bullish_strong"
					case emaGap > 0.5:
						sub.AlignmentScore = 7  // 多头排列
						sub.EMAAlignment = "bullish"
					default:
						sub.AlignmentScore = 5  // 微弱多头
						sub.EMAAlignment = "bullish_weak"
					}
				} else if ema20Last > ema50Last*0.98 {
					sub.AlignmentScore = 3  // 接近金叉
					sub.EMAAlignment = "golden_cross_near"
				} else {
					sub.AlignmentScore = 0
					sub.EMAAlignment = "bearish"
				}
			} else {
				// 做空：希望空头排列 (EMA20 < EMA50)
				if ema20Last < ema50Last {
					// 计算EMA20与EMA50的距离
					emaGap := (ema50Last - ema20Last) / ema50Last * 100
					switch {
					case emaGap > 2:
						sub.AlignmentScore = 9  // 明显空头排列
						sub.EMAAlignment = "bearish_strong"
					case emaGap > 0.5:
						sub.AlignmentScore = 7  // 空头排列
						sub.EMAAlignment = "bearish"
					default:
						sub.AlignmentScore = 5  // 微弱空头
						sub.EMAAlignment = "bearish_weak"
					}
				} else if ema20Last < ema50Last*1.02 {
					sub.AlignmentScore = 3  // 接近死叉
					sub.EMAAlignment = "death_cross_near"
				} else {
					sub.AlignmentScore = 0
					sub.EMAAlignment = "bullish"
				}
			}
		}
	}
	if sub.AlignmentScore == 0 && sub.PricePosScore > 0 {
		sub.AlignmentScore = 3 // 有价格位置但没有排列数据，给基础分
	}
	totalScore += sub.AlignmentScore

	// === 3. EMA斜率评分 (8分) ===
	if data.TimeframeData != nil {
		tfKey := "5m"
		if tf, ok := data.TimeframeData[tfKey]; ok && len(tf.EMA20Values) >= 3 {
			ema20Current := tf.EMA20Values[len(tf.EMA20Values)-1]
			ema20Prev := tf.EMA20Values[len(tf.EMA20Values)-2]
			ema20Prev2 := tf.EMA20Values[len(tf.EMA20Values)-3]

			// 计算斜率（百分比变化）
			slope1 := (ema20Current - ema20Prev) / ema20Prev * 100
			slope2 := (ema20Prev - ema20Prev2) / ema20Prev2 * 100

			// 判断斜率方向
			if slope1 > 0 && slope2 > 0 {
				sub.EMASlope = "up"
				if isLong {
					// 做多时EMA向上是好事
					avgSlope := (slope1 + slope2) / 2
					switch {
					case avgSlope > 0.5:
						sub.SlopeScore = 8  // 强势上涨
					case avgSlope > 0.2:
						sub.SlopeScore = 6  // 适度上涨
					default:
						sub.SlopeScore = 4  // 缓慢上涨
					}
				} else {
					sub.SlopeScore = 2 // 做空时EMA向上不太好
				}
			} else if slope1 < 0 && slope2 < 0 {
				sub.EMASlope = "down"
				if isLong {
					sub.SlopeScore = 2 // 做多时EMA向下不太好
				} else {
					// 做空时EMA向下是好事
					avgSlope := (math.Abs(slope1) + math.Abs(slope2)) / 2
					switch {
					case avgSlope > 0.5:
						sub.SlopeScore = 8  // 强势下跌
					case avgSlope > 0.2:
						sub.SlopeScore = 6  // 适度下跌
					default:
						sub.SlopeScore = 4  // 缓慢下跌
					}
				}
			} else {
				sub.EMASlope = "sideways"
				sub.SlopeScore = 4 // 横盘
			}
		}
	}
	if sub.SlopeScore == 0 {
		sub.SlopeScore = 3 // 无数据时给中等分
	}
	totalScore += sub.SlopeScore

	return totalScore, sub
}

// scoreVolumePriceEnhanced 量价增强评分 (最高20分)
// = OI+价格(10) + 成交量(5) + 量价背离(5)
func (s *SignalScorer) scoreVolumePriceEnhanced(data *market.Data, isLong bool) (int, *VolumeSubScore) {
	sub := &VolumeSubScore{}
	totalScore := 0

	if data == nil {
		return 10, sub // 无数据时给中等分
	}

	// === 1. OI + 价格变化评分 (10分) ===
	priceChange := data.PriceChange1h

	var oiChange float64
	if data.OpenInterest != nil && data.OpenInterest.Average > 0 {
		oiChange = (data.OpenInterest.Latest - data.OpenInterest.Average) / data.OpenInterest.Average * 100
	}
	sub.OIChange = oiChange

	if isLong {
		// 做多：希望看到OI增加+价格上涨（资金流入+价格涨）
		if oiChange > 5 && priceChange > 2 {
			sub.OIPriceScore = 10 // 完美配合：大资金流入+大涨
		} else if oiChange > 2 && priceChange > 0 {
			sub.OIPriceScore = 8  // 良好配合
		} else if oiChange > 0 && priceChange > 0 {
			sub.OIPriceScore = 6  // 基本配合
		} else if priceChange > 2 {
			sub.OIPriceScore = 4  // 价格涨但OI未增（可能是空头平仓）
		} else if oiChange > 0 {
			sub.OIPriceScore = 4  // OI增但价格未动
		} else {
			sub.OIPriceScore = 2  // 量价不配合
		}
	} else {
		// 做空：希望看到OI增加+价格下跌（资金流入+价格跌）
		if oiChange > 5 && priceChange < -2 {
			sub.OIPriceScore = 10 // 完美配合：大资金流入+大跌
		} else if oiChange > 2 && priceChange < 0 {
			sub.OIPriceScore = 8  // 良好配合
		} else if oiChange > 0 && priceChange < 0 {
			sub.OIPriceScore = 6  // 基本配合
		} else if priceChange < -2 {
			sub.OIPriceScore = 4  // 价格跌但OI未增（可能是多头平仓）
		} else if oiChange > 0 {
			sub.OIPriceScore = 4  // OI增但价格未动
		} else {
			sub.OIPriceScore = 2  // 量价不配合
		}
	}
	totalScore += sub.OIPriceScore

	// === 2. 成交量评分 (5分) ===
	// 检查成交量是否放大（使用TimeframeData中的Volume）
	if data.TimeframeData != nil {
		if tf, ok := data.TimeframeData["5m"]; ok && len(tf.Volume) >= 2 {
			// 计算最近成交量与之前成交量的比率
			recentVol := tf.Volume[len(tf.Volume)-1]
			avgVol := 0.0
			if len(tf.Volume) >= 5 {
				for i := len(tf.Volume) - 5; i < len(tf.Volume)-1; i++ {
					avgVol += tf.Volume[i]
				}
				avgVol /= 4
			}

			if avgVol > 0 {
				volumeRatio := recentVol / avgVol
				sub.VolumeRatio = volumeRatio

				// 成交量适度放大是好事，但过大可能是异常
				switch {
				case volumeRatio > 3.0:
					sub.VolumeScore = 2  // 异常放量，可能不稳定
				case volumeRatio > 2.0:
					sub.VolumeScore = 5  // 明显放量，好信号
				case volumeRatio > 1.5:
					sub.VolumeScore = 4  // 适度放量
				case volumeRatio > 1.0:
					sub.VolumeScore = 3  // 成交量正常
				default:
					sub.VolumeScore = 2  // 缩量
				}
			}
		}
	}
	if sub.VolumeScore == 0 {
		sub.VolumeScore = 3 // 无数据时给中等分
	}
	totalScore += sub.VolumeScore

	// === 3. 量价背离评分 (5分) ===
	// 检测量价背离（需要K线数据）
	if data.TimeframeData != nil {
		tfKey := "5m"
		if tf, ok := data.TimeframeData[tfKey]; ok && len(tf.Klines) >= 5 && len(tf.Volume) >= 5 {
			// 提取收盘价
			closePrices := make([]float64, len(tf.Klines))
			for i, k := range tf.Klines {
				closePrices[i] = k.Close
			}
			sub.HasDivergence, sub.DivergeScore = s.detectVolumeDivergence(closePrices, tf.Volume, isLong)
		}
	}
	if sub.DivergeScore == 0 {
		sub.DivergeScore = 3 // 无数据时给中等分
	}
	totalScore += sub.DivergeScore

	return totalScore, sub
}

// detectVolumeDivergence 检测量价背离
// 价涨量缩 = 警告信号
// 价跌量增 = 可能反转
func (s *SignalScorer) detectVolumeDivergence(prices []float64, volumes []float64, isLong bool) (bool, int) {
	if len(prices) < 5 || len(volumes) < 5 {
		return false, 3
	}

	// 取最近5根K线
	recentPrices := prices[len(prices)-5:]
	recentVolumes := volumes[len(volumes)-5:]

	// 计算价格和成交量的趋势
	priceUp := recentPrices[len(recentPrices)-1] > recentPrices[0]
	volumeDown := recentVolumes[len(recentVolumes)-1] < recentVolumes[0]
	volumeUp := recentVolumes[len(recentVolumes)-1] > recentVolumes[0]
	priceDown := recentPrices[len(recentPrices)-1] < recentPrices[0]

	if isLong {
		// 做多时
		if priceUp && volumeDown {
			// 价涨量缩 = 上涨乏力
			return true, 1
		} else if priceUp && volumeUp {
			// 价涨量增 = 健康上涨
			return false, 5
		}
	} else {
		// 做空时
		if priceDown && volumeDown {
			// 价跌量缩 = 下跌乏力
			return true, 1
		} else if priceDown && volumeUp {
			// 价跌量增 = 健康下跌
			return false, 5
		}
	}

	return false, 3
}

// scoreMultiTimeframeEnhanced 多周期增强评分 (最高30分)
// = 短周期(8) + 中周期(10) + 长周期(12)
func (s *SignalScorer) scoreMultiTimeframeEnhanced(
	tfData map[string]*market.TimeframeSeriesData,
	marketData *market.Data,
	isLong bool,
) (int, *MultiTFSubScore) {
	sub := &MultiTFSubScore{
		TFTrends: make(map[string]string),
	}

	// 如果没有多时间框架数据，使用主市场数据
	if tfData == nil || len(tfData) == 0 {
		if marketData != nil && marketData.TimeframeData != nil {
			tfData = marketData.TimeframeData
		}
	}

	if tfData == nil || len(tfData) == 0 {
		return 15, sub // 无数据时给中等分
	}

	// 定义时间框架权重
	tfWeights := map[string]int{
		"5m":  8,  // 短周期
		"15m": 8,  // 短周期
		"30m": 10, // 中周期
		"1h":  10, // 中周期
		"4h":  12, // 长周期
		"1d":  12, // 长周期
	}

	// 分析各时间框架趋势
	shortScore := 0
	midScore := 0
	longScore := 0
	shortMax := 0
	midMax := 0
	longMax := 0

	for tf, data := range tfData {
		if len(data.EMA20Values) < 2 || len(data.EMA50Values) < 2 {
			continue
		}

		// 获取最近的EMA值
		ema20Last := data.EMA20Values[len(data.EMA20Values)-1]
		ema20Prev := data.EMA20Values[len(data.EMA20Values)-2]
		ema50Last := data.EMA50Values[len(data.EMA50Values)-1]

		// 判断趋势
		var trend string
		if ema20Last > ema50Last && ema20Last > ema20Prev {
			trend = "up"
		} else if ema20Last < ema50Last && ema20Last < ema20Prev {
			trend = "down"
		} else {
			trend = "sideways"
		}
		sub.TFTrends[tf] = trend

		// 计算得分
		weight, hasWeight := tfWeights[tf]
		if !hasWeight {
			weight = 8 // 默认权重
		}

		score := 0
		if isLong {
			if trend == "up" {
				score = weight
			} else if trend == "sideways" {
				score = weight / 2
			}
		} else {
			if trend == "down" {
				score = weight
			} else if trend == "sideways" {
				score = weight / 2
			}
		}

		// 分类累加
		if tf == "5m" || tf == "15m" {
			shortScore += score
			shortMax += weight
		} else if tf == "30m" || tf == "1h" {
			midScore += score
			midMax += weight
		} else {
			longScore += score
			longMax += weight
		}
	}

	// 归一化到目标分数
	if shortMax > 0 {
		sub.ShortTFScore = shortScore * 8 / shortMax
	} else {
		sub.ShortTFScore = 4
	}

	if midMax > 0 {
		sub.MidTFScore = midScore * 10 / midMax
	} else {
		sub.MidTFScore = 5
	}

	if longMax > 0 {
		sub.LongTFScore = longScore * 12 / longMax
	} else {
		sub.LongTFScore = 6
	}

	// 判断整体排列状态
	upCount := 0
	downCount := 0
	for _, trend := range sub.TFTrends {
		if trend == "up" {
			upCount++
		} else if trend == "down" {
			downCount++
		}
	}

	totalTF := len(sub.TFTrends)
	if isLong {
		if upCount == totalTF {
			sub.TFAlignment = "perfect_bullish"
		} else if upCount >= totalTF-1 {
			sub.TFAlignment = "strong_bullish"
		} else if upCount >= totalTF/2 {
			sub.TFAlignment = "mixed_bullish"
		} else {
			sub.TFAlignment = "bearish"
		}
	} else {
		if downCount == totalTF {
			sub.TFAlignment = "perfect_bearish"
		} else if downCount >= totalTF-1 {
			sub.TFAlignment = "strong_bearish"
		} else if downCount >= totalTF/2 {
			sub.TFAlignment = "mixed_bearish"
		} else {
			sub.TFAlignment = "bullish"
		}
	}

	totalScore := sub.ShortTFScore + sub.MidTFScore + sub.LongTFScore
	return totalScore, sub
}

// generateDetailsEnhanced 生成增强版评分详情
func (s *SignalScorer) generateDetailsEnhanced(score *SignalScore, isLong bool) string {
	var details strings.Builder

	direction := "做多"
	if !isLong {
		direction = "做空"
	}

	details.WriteString(fmt.Sprintf("【%s信号评分】总分: %d/100\n", direction, score.Total))

	// RSI详情
	if score.RSISubScore != nil {
		details.WriteString(fmt.Sprintf("• RSI信号: %d/25 (位置%d + 趋势%d + 背离%d)\n",
			score.RSIScore,
			score.RSISubScore.PositionScore,
			score.RSISubScore.TrendScore,
			score.RSISubScore.DivergeScore))
	} else {
		details.WriteString(fmt.Sprintf("• RSI信号: %d/25\n", score.RSIScore))
	}

	// EMA详情
	if score.EMASubScore != nil {
		details.WriteString(fmt.Sprintf("• EMA趋势: %d/25 (位置%d + 排列%d + 斜率%d)\n",
			score.EMAScore,
			score.EMASubScore.PricePosScore,
			score.EMASubScore.AlignmentScore,
			score.EMASubScore.SlopeScore))
	} else {
		details.WriteString(fmt.Sprintf("• EMA趋势: %d/25\n", score.EMAScore))
	}

	// 量价详情
	if score.VolumeSubScore != nil {
		details.WriteString(fmt.Sprintf("• 量价配合: %d/20 (OI价%d + 量%d + 背离%d)\n",
			score.VolumePriceScore,
			score.VolumeSubScore.OIPriceScore,
			score.VolumeSubScore.VolumeScore,
			score.VolumeSubScore.DivergeScore))
	} else {
		details.WriteString(fmt.Sprintf("• 量价配合: %d/20\n", score.VolumePriceScore))
	}

	// 多周期详情
	if score.MultiTFSubScore != nil {
		details.WriteString(fmt.Sprintf("• 多周期: %d/30 (短%d + 中%d + 长%d)\n",
			score.MultiTFScore,
			score.MultiTFSubScore.ShortTFScore,
			score.MultiTFSubScore.MidTFScore,
			score.MultiTFSubScore.LongTFScore))
	} else {
		details.WriteString(fmt.Sprintf("• 多周期共振: %d/30\n", score.MultiTFScore))
	}

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
	var tfData map[string]*market.TimeframeSeriesData
	if multiTFData != nil {
		tfData = make(map[string]*market.TimeframeSeriesData)
		for tf, data := range multiTFData {
			if data.TimeframeData != nil {
				if tfSeries, ok := data.TimeframeData[tf]; ok {
					tfData[tf] = tfSeries
				}
			}
		}
	}
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
