package kernel

import (
	"fmt"
	"math"
	"strings"

	"nofx/market"
	"nofx/store"
)

// ============================================================================
// Signal Scorer - 信号质量评分器 (v2.0 改进版)
// ============================================================================
// 对交易信号进行综合评分，只接受高质量信号
//
// 评分维度 (总分100分):
// - RSI位置 (25分): 超卖区做多/超买区做空得分高
// - EMA趋势 (25分): 位置8分 + 斜率8分 + 排列9分
// - 量价配合 (20分): OI变化12分 + 成交量确认8分 (无数据=0分)
// - 多周期共振 (30分): 趋势一致性20分 + 关键位置10分 (无数据=0分)
//
// 改进点:
// 1. 无数据时不再给"同情分"，严格0分
// 2. EMA评分拆分为位置、斜率、排列三部分
// 3. 量价评分拆分为OI变化和成交量确认
// 4. 多周期评分拆分为趋势一致性和关键位置
// ============================================================================

// SignalScorer 信号评分器
type SignalScorer struct{}

// SignalScore 信号评分结果
type SignalScore struct {
	Total            int    `json:"total"`             // 总分 (0-100)
	RSIScore         int    `json:"rsi_score"`         // RSI得分 (0-25)
	EMAScore         int    `json:"ema_score"`         // EMA趋势得分 (0-23)
	VolumePriceScore int    `json:"volume_price_score"` // 量价配合得分 (0-20)
	MultiTFScore     int    `json:"multi_tf_score"`    // 多周期共振得分 (0-30)
	Details          string `json:"details"`           // 评分详情

	// 详细子分数
	RSIValue       float64 `json:"rsi_value,omitempty"`        // 当前RSI值
	EMAPosition    int     `json:"ema_position,omitempty"`     // EMA位置得分 (0-8)
	EMASlope       int     `json:"ema_slope,omitempty"`        // EMA斜率得分 (0-8)
	EMAAlignment   int     `json:"ema_alignment,omitempty"`    // EMA排列得分 (0-7)
	OIChange       int     `json:"oi_change,omitempty"`        // OI变化得分 (0-12)
	VolumeConfirm  int     `json:"volume_confirm,omitempty"`   // 成交量确认得分 (0-8)
	TrendConsist   int     `json:"trend_consist,omitempty"`    // 趋势一致性得分 (0-20)
	KeyPosition    int     `json:"key_position,omitempty"`     // 关键位置得分 (0-10)
	OIChangePct    float64 `json:"oi_change_pct,omitempty"`    // OI变化百分比
	VolumeRatio    float64 `json:"volume_ratio,omitempty"`     // 成交量比率
	TrendDirection string  `json:"trend_direction,omitempty"`  // 趋势方向
	TrendTFCount   int     `json:"trend_tf_count,omitempty"`   // 同向趋势时间框架数
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

	// 保存RSI值
	score.RSIValue = marketData.CurrentRSI7

	// 1. RSI位置评分 (25分)
	score.RSIScore = s.scoreRSI(marketData.CurrentRSI7, isLong)

	// 2. EMA趋势评分 (23分) - 位置8分 + 斜率8分 + 排列7分
	emaResult := s.scoreEMATrendDetailed(marketData, isLong)
	score.EMAScore = emaResult.total
	score.EMAPosition = emaResult.position
	score.EMASlope = emaResult.slope
	score.EMAAlignment = emaResult.alignment

	// 3. 量价配合评分 (20分) - OI变化12分 + 成交量确认8分
	vpResult := s.scoreVolumePriceDetailed(marketData, isLong)
	score.VolumePriceScore = vpResult.total
	score.OIChange = vpResult.oiChange
	score.VolumeConfirm = vpResult.volumeConfirm
	score.OIChangePct = vpResult.oiChangePct
	score.VolumeRatio = vpResult.volumeRatio

	// 4. 多周期共振评分 (30分) - 趋势一致性20分 + 关键位置10分
	mtfResult := s.scoreMultiTimeframeDetailed(multiTFData, isLong)
	score.MultiTFScore = mtfResult.total
	score.TrendConsist = mtfResult.trendConsist
	score.KeyPosition = mtfResult.keyPosition
	score.TrendDirection = mtfResult.trendDirection
	score.TrendTFCount = mtfResult.tfCount

	// 计算总分
	score.Total = score.RSIScore + score.EMAScore + score.VolumePriceScore + score.MultiTFScore

	// 生成详情
	score.Details = s.generateDetails(score, marketData.CurrentRSI7, isLong)

	return score
}

// EMAScoreResult EMA评分详细结果
type EMAScoreResult struct {
	total     int
	position  int
	slope     int
	alignment int
}

// VolumePriceResult 量价评分详细结果
type VolumePriceResult struct {
	total        int
	oiChange     int
	volumeConfirm int
	oiChangePct  float64
	volumeRatio  float64
}

// MultiTFResult 多周期评分详细结果
type MultiTFResult struct {
	total         int
	trendConsist  int
	keyPosition   int
	trendDirection string
	tfCount       int
}

// ============================================================================
// RSI位置评分 (最高25分)
// ============================================================================
// 做多：RSI越低越好（超卖区买入更安全）
// 做空：RSI越高越好（超买区卖出更安全）
func (s *SignalScorer) scoreRSI(rsi float64, isLong bool) int {
	if rsi == 0 {
		return 0 // 无数据
	}

	if isLong {
		// 做多：RSI越低越好
		switch {
		case rsi < 25:
			return 25 // 极度超卖，完美入场点
		case rsi < 30:
			return 22 // 超卖区
		case rsi < 40:
			return 16 // 偏低
		case rsi < 50:
			return 10 // 中性偏弱
		case rsi < 60:
			return 6  // 中性偏强
		case rsi < 70:
			return 3  // 偏高，追高风险
		default:
			return 0  // 超买区，不适合做多
		}
	} else {
		// 做空：RSI越高越好
		switch {
		case rsi > 75:
			return 25 // 极度超买，完美入场点
		case rsi > 70:
			return 22 // 超买区
		case rsi > 60:
			return 16 // 偏高
		case rsi > 50:
			return 10 // 中性偏强
		case rsi > 40:
			return 6  // 中性偏弱
		case rsi > 30:
			return 3  // 偏低，追空风险
		default:
			return 0  // 超卖区，不适合做空
		}
	}
}

// ============================================================================
// EMA趋势评分 (最高25分)
// ============================================================================
// 拆分为三部分：
// A. 价格位置 (8分): 价格相对于EMA20的位置和偏离程度
// B. EMA斜率 (8分): EMA20的倾斜方向和角度
// C. EMA排列 (9分): EMA20/50/100的排列状态
func (s *SignalScorer) scoreEMATrend(data *market.Data, isLong bool) int {
	if data == nil || data.CurrentEMA20 == 0 {
		return 0
	}

	totalScore := 0
	price := data.CurrentPrice
	ema20 := data.CurrentEMA20

	// ========== A. 价格位置评分 (8分) ==========
	positionScore := 0
	if isLong {
		if price > ema20 {
			deviationPct := (price - ema20) / ema20 * 100
			switch {
			case deviationPct < 1:
				positionScore = 8 // 刚站上EMA20，最佳入场
			case deviationPct < 2:
				positionScore = 6 // 适度高于EMA20
			case deviationPct < 4:
				positionScore = 4 // 略有偏离
			case deviationPct < 6:
				positionScore = 2 // 偏离较大，追高风险
			default:
				positionScore = 0 // 严重偏离，不适合入场
			}
		}
	} else {
		if price < ema20 {
			deviationPct := (ema20 - price) / ema20 * 100
			switch {
			case deviationPct < 1:
				positionScore = 8 // 刚跌破EMA20，最佳入场
			case deviationPct < 2:
				positionScore = 6 // 适度低于EMA20
			case deviationPct < 4:
				positionScore = 4 // 略有偏离
			case deviationPct < 6:
				positionScore = 2 // 偏离较大，追空风险
			default:
				positionScore = 0 // 严重偏离，不适合入场
			}
		}
	}
	totalScore += positionScore

	// ========== B. EMA斜率评分 (8分) ==========
	slopeScore := 0
	if data.TimeframeData != nil {
		if primaryTF, ok := data.TimeframeData["5m"]; ok && len(primaryTF.EMA20Values) >= 3 {
			ema20Last := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-1]
			ema20Prev := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-2]
			ema20Prev2 := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-3]

			// 计算斜率 (百分比变化)
			slope1 := (ema20Last - ema20Prev) / ema20Prev * 100
			slope2 := (ema20Prev - ema20Prev2) / ema20Prev2 * 100
			avgSlope := (slope1 + slope2) / 2

			if isLong {
				// 做多：希望EMA向上倾斜
				switch {
				case avgSlope > 0.5:
					slopeScore = 8 // 强势上涨斜率
				case avgSlope > 0.2:
					slopeScore = 6 // 中等上涨斜率
				case avgSlope > 0:
					slopeScore = 4 // 温和上涨
				case avgSlope > -0.1:
					slopeScore = 2 // 走平
				default:
					slopeScore = 0 // 下跌斜率
				}
			} else {
				// 做空：希望EMA向下倾斜
				switch {
				case avgSlope < -0.5:
					slopeScore = 8 // 强势下跌斜率
				case avgSlope < -0.2:
					slopeScore = 6 // 中等下跌斜率
				case avgSlope < 0:
					slopeScore = 4 // 温和下跌
				case avgSlope < 0.1:
					slopeScore = 2 // 走平
				default:
					slopeScore = 0 // 上涨斜率
				}
			}
		}
	}
	totalScore += slopeScore

	// ========== C. EMA排列评分 (9分) ==========
	// 注意：TimeframeSeriesData 只有 EMA20 和 EMA50，没有 EMA100
	// 所以排列评分调整为只使用 EMA20/50 的关系，最高7分
	alignmentScore := 0
	if data.TimeframeData != nil {
		if primaryTF, ok := data.TimeframeData["5m"]; ok && len(primaryTF.EMA20Values) > 0 && len(primaryTF.EMA50Values) > 0 {
			ema20Last := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-1]
			ema50Last := primaryTF.EMA50Values[len(primaryTF.EMA50Values)-1]

			// 计算EMA间距比例
			gap := (ema20Last - ema50Last) / ema50Last * 100

			if isLong {
				// 做多：希望EMA20 > EMA50 且间距适中
				switch {
				case gap > 0.5 && gap < 2:
					alignmentScore = 7 // 理想多头排列 (间距适中)
				case gap > 0:
					alignmentScore = 5 // 多头排列 (刚形成)
				case gap > -0.3:
					alignmentScore = 3 // 接近金叉
				case gap > -1:
					alignmentScore = 1 // 略低于EMA50
				}
			} else {
				// 做空：希望EMA20 < EMA50 且间距适中
				switch {
				case gap < -0.5 && gap > -2:
					alignmentScore = 7 // 理想空头排列 (间距适中)
				case gap < 0:
					alignmentScore = 5 // 空头排列 (刚形成)
				case gap < 0.3:
					alignmentScore = 3 // 接近死叉
				case gap < 1:
					alignmentScore = 1 // 略高于EMA50
				}
			}
		}
	}
	totalScore += alignmentScore

	return totalScore
}

// ============================================================================
// 量价配合评分 (最高20分)
// ============================================================================
// 拆分为两部分：
// A. OI变化 + 价格方向 (12分): OI增加且价格同向得分高
// B. 成交量确认 (8分): 成交量放大确认趋势有效性
//
// 注意：无数据时给0分，不给"同情分"
func (s *SignalScorer) scoreVolumePrice(data *market.Data, isLong bool) int {
	if data == nil {
		return 0
	}

	totalScore := 0

	// ========== A. OI变化评分 (12分) ==========
	oiScore := 0
	if data.OpenInterest != nil && data.OpenInterest.Average > 0 {
		priceChange := data.PriceChange1h
		oiChange := (data.OpenInterest.Latest - data.OpenInterest.Average) / data.OpenInterest.Average * 100

		if isLong {
			// 做多：希望看到OI增加+价格上涨 (新资金入场推高价格)
			switch {
			case oiChange > 3 && priceChange > 1:
				oiScore = 12 // 完美配合：资金大量流入+价格上涨
			case oiChange > 1 && priceChange > 0.5:
				oiScore = 9 // 良好配合
			case oiChange > 0 && priceChange > 0:
				oiScore = 6 // 一般配合
			case oiChange > 0 && priceChange > -0.5:
				oiScore = 4 // OI增加但价格未动
			case priceChange > 1:
				oiScore = 2 // 价格上涨但OI未增加 (可能是空头平仓)
			default:
				oiScore = 0 // 量价背离
			}
		} else {
			// 做空：希望看到OI增加+价格下跌 (新资金入场推低价格)
			switch {
			case oiChange > 3 && priceChange < -1:
				oiScore = 12 // 完美配合：资金大量流入+价格下跌
			case oiChange > 1 && priceChange < -0.5:
				oiScore = 9 // 良好配合
			case oiChange > 0 && priceChange < 0:
				oiScore = 6 // 一般配合
			case oiChange > 0 && priceChange < 0.5:
				oiScore = 4 // OI增加但价格未动
			case priceChange < -1:
				oiScore = 2 // 价格下跌但OI未增加 (可能是多头平仓)
			default:
				oiScore = 0 // 量价背离
			}
		}
	}
	// 无OI数据时，oiScore保持为0
	totalScore += oiScore

	// ========== B. 成交量确认评分 (8分) ==========
	volumeScore := 0

	// 尝试从TimeframeData获取成交量数据
	if data.TimeframeData != nil {
		if primaryTF, ok := data.TimeframeData["5m"]; ok && len(primaryTF.Klines) >= 24 {
			klines := primaryTF.Klines

			// 计算最近24根K线的平均成交量
			var totalVol float64
			for i := len(klines) - 24; i < len(klines); i++ {
				totalVol += klines[i].Volume
			}
			avgVol := totalVol / 24

			// 最新K线的成交量
			latestVol := klines[len(klines)-1].Volume

			if avgVol > 0 {
				volRatio := latestVol / avgVol

				switch {
				case volRatio > 2.0:
					volumeScore = 8 // 成交量爆发 (>2倍均量)
				case volRatio > 1.5:
					volumeScore = 6 // 成交量明显放大
				case volRatio > 1.2:
					volumeScore = 4 // 成交量略高于平均
				case volRatio > 0.8:
					volumeScore = 2 // 成交量正常
				default:
					volumeScore = 0 // 成交量萎缩
				}
			}
		} else if len(primaryTF.Volume) >= 24 {
			// 使用旧的Volume字段
			volumes := primaryTF.Volume
			var totalVol float64
			for i := len(volumes) - 24; i < len(volumes); i++ {
				totalVol += volumes[i]
			}
			avgVol := totalVol / 24
			latestVol := volumes[len(volumes)-1]

			if avgVol > 0 {
				volRatio := latestVol / avgVol

				switch {
				case volRatio > 2.0:
					volumeScore = 8
				case volRatio > 1.5:
					volumeScore = 6
				case volRatio > 1.2:
					volumeScore = 4
				case volRatio > 0.8:
					volumeScore = 2
				default:
					volumeScore = 0
				}
			}
		}
	}
	// 无成交量数据时，volumeScore保持为0
	totalScore += volumeScore

	return totalScore
}

// ============================================================================
// 多周期共振评分 (最高30分)
// ============================================================================
// 拆分为两部分：
// A. 趋势一致性 (20分): 15m/1h/4h趋势方向一致程度
// B. 关键位置确认 (10分): 更大周期在关键支撑/阻力位
//
// 注意：无数据时给0分，不给"同情分"
func (s *SignalScorer) scoreMultiTimeframe(tfData map[string]*market.TimeframeSeriesData, isLong bool) int {
	if tfData == nil || len(tfData) == 0 {
		return 0 // 无数据，0分
	}

	totalScore := 0

	// ========== A. 趋势一致性评分 (20分) ==========
	// 分析各时间框架趋势
	trends := make(map[string]string) // "up", "down", "sideways"

	// 优先检查关键时间框架：15m, 1h, 4h
	keyTimeframes := []string{"15m", "1h", "4h", "5m"}

	for _, tf := range keyTimeframes {
		data, ok := tfData[tf]
		if !ok {
			continue
		}
		if len(data.EMA20Values) < 2 || len(data.EMA50Values) < 2 {
			continue
		}

		// 获取最近的EMA值
		ema20Last := data.EMA20Values[len(data.EMA20Values)-1]
		ema20Prev := data.EMA20Values[len(data.EMA20Values)-2]
		ema50Last := data.EMA50Values[len(data.EMA50Values)-1]

		// 判断趋势
		emaSlope := (ema20Last - ema20Prev) / ema20Prev * 100

		if ema20Last > ema50Last && emaSlope > 0.05 {
			trends[tf] = "up"
		} else if ema20Last < ema50Last && emaSlope < -0.05 {
			trends[tf] = "down"
		} else {
			trends[tf] = "sideways"
		}
	}

	// 计算共振程度
	upCount := 0
	downCount := 0
	sidewaysCount := 0

	for _, trend := range trends {
		switch trend {
		case "up":
			upCount++
		case "down":
			downCount++
		default:
			sidewaysCount++
		}
	}

	totalTF := len(trends)
	if totalTF == 0 {
		return 0 // 无有效数据
	}

	consistencyScore := 0

	if isLong {
		// 做多：希望多个时间框架显示上涨趋势
		switch {
		case upCount == totalTF:
			consistencyScore = 20 // 完美共振
		case upCount == totalTF-1 && sidewaysCount == 1:
			consistencyScore = 16 // 几乎一致 (1个横盘)
		case upCount >= totalTF/2+1:
			consistencyScore = 12 // 多数一致
		case upCount > 0 && downCount == 0:
			consistencyScore = 6 // 少数一致但无冲突
		case upCount > 0:
			consistencyScore = 3 // 有冲突
		default:
			consistencyScore = 0 // 完全逆向
		}
	} else {
		// 做空：希望多个时间框架显示下跌趋势
		switch {
		case downCount == totalTF:
			consistencyScore = 20 // 完美共振
		case downCount == totalTF-1 && sidewaysCount == 1:
			consistencyScore = 16 // 几乎一致 (1个横盘)
		case downCount >= totalTF/2+1:
			consistencyScore = 12 // 多数一致
		case downCount > 0 && upCount == 0:
			consistencyScore = 6 // 少数一致但无冲突
		case downCount > 0:
			consistencyScore = 3 // 有冲突
		default:
			consistencyScore = 0 // 完全逆向
		}
	}
	totalScore += consistencyScore

	// ========== B. 关键位置确认评分 (10分) ==========
	// 检查更大周期是否在关键位置
	keyPositionScore := 0

	// 检查1h和4h是否在布林带位置
	for _, tf := range []string{"1h", "4h"} {
		data, ok := tfData[tf]
		if !ok || len(data.Klines) < 2 {
			continue
		}

		// 获取最新K线
		latestKline := data.Klines[len(data.Klines)-1]

		// 检查布林带数据
		if len(data.BOLLUpper) > 0 && len(data.BOLLLower) > 0 && len(data.BOLLMiddle) > 0 {
			upper := data.BOLLUpper[len(data.BOLLUpper)-1]
			lower := data.BOLLLower[len(data.BOLLLower)-1]
			close := latestKline.Close

			// 计算价格在布林带中的位置
			bandWidth := upper - lower
			if bandWidth > 0 {
				position := (close - lower) / bandWidth // 0=下轨, 1=上轨

				if isLong {
					// 做多：希望在下半部分 (接近支撑)
					if position < 0.3 {
						keyPositionScore = 10 // 接近下轨支撑
					} else if position < 0.5 {
						keyPositionScore = 6 // 中下位置
					} else if position < 0.7 {
						keyPositionScore = 3 // 中上位置
					}
					// position > 0.7 接近上轨，不适合做多
				} else {
					// 做空：希望在上半部分 (接近阻力)
					if position > 0.7 {
						keyPositionScore = 10 // 接近上轨阻力
					} else if position > 0.5 {
						keyPositionScore = 6 // 中上位置
					} else if position > 0.3 {
						keyPositionScore = 3 // 中下位置
					}
					// position < 0.3 接近下轨，不适合做空
				}

				if keyPositionScore > 0 {
					break // 找到一个关键位置确认即可
				}
			}
		}

		// 检查EMA支撑/阻力
		if len(data.EMA20Values) > 0 && len(data.EMA50Values) > 0 {
			ema20 := data.EMA20Values[len(data.EMA20Values)-1]
			ema50 := data.EMA50Values[len(data.EMA50Values)-1]
			close := latestKline.Close

			if isLong {
				// 做多：价格接近EMA支撑
				ema20Dist := (close - ema20) / ema20 * 100
				ema50Dist := (close - ema50) / ema50 * 100

				if ema20Dist < 0.5 && ema20Dist > -0.5 {
					keyPositionScore = 8 // 刚好在EMA20附近
				} else if ema50Dist < 1 && ema50Dist > -1 {
					keyPositionScore = 6 // 接近EMA50支撑
				}
			} else {
				// 做空：价格接近EMA阻力
				ema20Dist := (close - ema20) / ema20 * 100
				ema50Dist := (close - ema50) / ema50 * 100

				if ema20Dist < 0.5 && ema20Dist > -0.5 {
					keyPositionScore = 8 // 刚好在EMA20附近
				} else if ema50Dist < 1 && ema50Dist > -1 && close < ema50 {
					keyPositionScore = 6 // 接近EMA50阻力
				}
			}

			if keyPositionScore > 0 {
				break
			}
		}
	}
	totalScore += keyPositionScore

	return totalScore
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
	details.WriteString(fmt.Sprintf("• EMA趋势: %d/25 (位置+斜率+排列)\n", score.EMAScore))
	details.WriteString(fmt.Sprintf("• 量价配合: %d/20 (OI变化+成交量)\n", score.VolumePriceScore))
	details.WriteString(fmt.Sprintf("• 多周期共振: %d/30 (一致性+关键位置)\n", score.MultiTFScore))

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

// ============================================================================
// 详细评分函数 - 返回子分数
// ============================================================================

// scoreEMATrendDetailed EMA趋势详细评分
func (s *SignalScorer) scoreEMATrendDetailed(data *market.Data, isLong bool) EMAScoreResult {
	result := EMAScoreResult{}

	if data == nil || data.CurrentEMA20 == 0 {
		return result
	}

	price := data.CurrentPrice
	ema20 := data.CurrentEMA20

	// A. 价格位置评分 (8分)
	if isLong {
		if price > ema20 {
			deviationPct := (price - ema20) / ema20 * 100
			switch {
			case deviationPct < 1:
				result.position = 8
			case deviationPct < 2:
				result.position = 6
			case deviationPct < 4:
				result.position = 4
			case deviationPct < 6:
				result.position = 2
			}
		}
	} else {
		if price < ema20 {
			deviationPct := (ema20 - price) / ema20 * 100
			switch {
			case deviationPct < 1:
				result.position = 8
			case deviationPct < 2:
				result.position = 6
			case deviationPct < 4:
				result.position = 4
			case deviationPct < 6:
				result.position = 2
			}
		}
	}

	// B. EMA斜率评分 (8分)
	if data.TimeframeData != nil {
		if primaryTF, ok := data.TimeframeData["5m"]; ok && len(primaryTF.EMA20Values) >= 3 {
			ema20Last := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-1]
			ema20Prev := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-2]
			ema20Prev2 := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-3]

			slope1 := (ema20Last - ema20Prev) / ema20Prev * 100
			slope2 := (ema20Prev - ema20Prev2) / ema20Prev2 * 100
			avgSlope := (slope1 + slope2) / 2

			if isLong {
				switch {
				case avgSlope > 0.5:
					result.slope = 8
				case avgSlope > 0.2:
					result.slope = 6
				case avgSlope > 0:
					result.slope = 4
				case avgSlope > -0.1:
					result.slope = 2
				}
			} else {
				switch {
				case avgSlope < -0.5:
					result.slope = 8
				case avgSlope < -0.2:
					result.slope = 6
				case avgSlope < 0:
					result.slope = 4
				case avgSlope < 0.1:
					result.slope = 2
				}
			}
		}
	}

	// C. EMA排列评分 (7分)
	if data.TimeframeData != nil {
		if primaryTF, ok := data.TimeframeData["5m"]; ok && len(primaryTF.EMA20Values) > 0 && len(primaryTF.EMA50Values) > 0 {
			ema20Last := primaryTF.EMA20Values[len(primaryTF.EMA20Values)-1]
			ema50Last := primaryTF.EMA50Values[len(primaryTF.EMA50Values)-1]
			gap := (ema20Last - ema50Last) / ema50Last * 100

			if isLong {
				switch {
				case gap > 0.5 && gap < 2:
					result.alignment = 7
				case gap > 0:
					result.alignment = 5
				case gap > -0.3:
					result.alignment = 3
				case gap > -1:
					result.alignment = 1
				}
			} else {
				switch {
				case gap < -0.5 && gap > -2:
					result.alignment = 7
				case gap < 0:
					result.alignment = 5
				case gap < 0.3:
					result.alignment = 3
				case gap < 1:
					result.alignment = 1
				}
			}
		}
	}

	result.total = result.position + result.slope + result.alignment
	return result
}

// scoreVolumePriceDetailed 量价配合详细评分
func (s *SignalScorer) scoreVolumePriceDetailed(data *market.Data, isLong bool) VolumePriceResult {
	result := VolumePriceResult{}

	if data == nil {
		return result
	}

	// A. OI变化评分 (12分)
	if data.OpenInterest != nil && data.OpenInterest.Average > 0 {
		priceChange := data.PriceChange1h
		result.oiChangePct = (data.OpenInterest.Latest - data.OpenInterest.Average) / data.OpenInterest.Average * 100

		if isLong {
			switch {
			case result.oiChangePct > 3 && priceChange > 1:
				result.oiChange = 12
			case result.oiChangePct > 1 && priceChange > 0.5:
				result.oiChange = 9
			case result.oiChangePct > 0 && priceChange > 0:
				result.oiChange = 6
			case result.oiChangePct > 0 && priceChange > -0.5:
				result.oiChange = 4
			case priceChange > 1:
				result.oiChange = 2
			}
		} else {
			switch {
			case result.oiChangePct > 3 && priceChange < -1:
				result.oiChange = 12
			case result.oiChangePct > 1 && priceChange < -0.5:
				result.oiChange = 9
			case result.oiChangePct > 0 && priceChange < 0:
				result.oiChange = 6
			case result.oiChangePct > 0 && priceChange < 0.5:
				result.oiChange = 4
			case priceChange < -1:
				result.oiChange = 2
			}
		}
	}

	// B. 成交量确认评分 (8分)
	if data.TimeframeData != nil {
		if primaryTF, ok := data.TimeframeData["5m"]; ok && len(primaryTF.Klines) >= 24 {
			klines := primaryTF.Klines
			var totalVol float64
			for i := len(klines) - 24; i < len(klines); i++ {
				totalVol += klines[i].Volume
			}
			avgVol := totalVol / 24
			latestVol := klines[len(klines)-1].Volume

			if avgVol > 0 {
				result.volumeRatio = latestVol / avgVol
				switch {
				case result.volumeRatio > 2.0:
					result.volumeConfirm = 8
				case result.volumeRatio > 1.5:
					result.volumeConfirm = 6
				case result.volumeRatio > 1.2:
					result.volumeConfirm = 4
				case result.volumeRatio > 0.8:
					result.volumeConfirm = 2
				}
			}
		} else if len(primaryTF.Volume) >= 24 {
			volumes := primaryTF.Volume
			var totalVol float64
			for i := len(volumes) - 24; i < len(volumes); i++ {
				totalVol += volumes[i]
			}
			avgVol := totalVol / 24
			latestVol := volumes[len(volumes)-1]

			if avgVol > 0 {
				result.volumeRatio = latestVol / avgVol
				switch {
				case result.volumeRatio > 2.0:
					result.volumeConfirm = 8
				case result.volumeRatio > 1.5:
					result.volumeConfirm = 6
				case result.volumeRatio > 1.2:
					result.volumeConfirm = 4
				case result.volumeRatio > 0.8:
					result.volumeConfirm = 2
				}
			}
		}
	}

	result.total = result.oiChange + result.volumeConfirm
	return result
}

// scoreMultiTimeframeDetailed 多周期共振详细评分
func (s *SignalScorer) scoreMultiTimeframeDetailed(tfData map[string]*market.TimeframeSeriesData, isLong bool) MultiTFResult {
	result := MultiTFResult{}

	if tfData == nil || len(tfData) == 0 {
		return result
	}

	// A. 趋势一致性评分 (20分)
	trends := make(map[string]string)
	keyTimeframes := []string{"15m", "1h", "4h", "5m"}

	for _, tf := range keyTimeframes {
		data, ok := tfData[tf]
		if !ok {
			continue
		}
		if len(data.EMA20Values) < 2 || len(data.EMA50Values) < 2 {
			continue
		}

		ema20Last := data.EMA20Values[len(data.EMA20Values)-1]
		ema20Prev := data.EMA20Values[len(data.EMA20Values)-2]
		ema50Last := data.EMA50Values[len(data.EMA50Values)-1]
		emaSlope := (ema20Last - ema20Prev) / ema20Prev * 100

		if ema20Last > ema50Last && emaSlope > 0.05 {
			trends[tf] = "up"
		} else if ema20Last < ema50Last && emaSlope < -0.05 {
			trends[tf] = "down"
		} else {
			trends[tf] = "sideways"
		}
	}

	upCount := 0
	downCount := 0
	sidewaysCount := 0
	for _, trend := range trends {
		switch trend {
		case "up":
			upCount++
		case "down":
			downCount++
		default:
			sidewaysCount++
		}
	}

	totalTF := len(trends)
	if totalTF == 0 {
		return result
	}

	if isLong {
		result.trendDirection = "up"
		result.tfCount = upCount
		switch {
		case upCount == totalTF:
			result.trendConsist = 20
		case upCount == totalTF-1 && sidewaysCount == 1:
			result.trendConsist = 16
		case upCount >= totalTF/2+1:
			result.trendConsist = 12
		case upCount > 0 && downCount == 0:
			result.trendConsist = 6
		case upCount > 0:
			result.trendConsist = 3
		}
	} else {
		result.trendDirection = "down"
		result.tfCount = downCount
		switch {
		case downCount == totalTF:
			result.trendConsist = 20
		case downCount == totalTF-1 && sidewaysCount == 1:
			result.trendConsist = 16
		case downCount >= totalTF/2+1:
			result.trendConsist = 12
		case downCount > 0 && upCount == 0:
			result.trendConsist = 6
		case downCount > 0:
			result.trendConsist = 3
		}
	}

	// B. 关键位置确认评分 (10分)
	for _, tf := range []string{"1h", "4h"} {
		data, ok := tfData[tf]
		if !ok || len(data.Klines) < 2 {
			continue
		}

		latestKline := data.Klines[len(data.Klines)-1]

		if len(data.BOLLUpper) > 0 && len(data.BOLLLower) > 0 && len(data.BOLLMiddle) > 0 {
			upper := data.BOLLUpper[len(data.BOLLUpper)-1]
			lower := data.BOLLLower[len(data.BOLLLower)-1]
			close := latestKline.Close

			bandWidth := upper - lower
			if bandWidth > 0 {
				position := (close - lower) / bandWidth

				if isLong {
					if position < 0.3 {
						result.keyPosition = 10
					} else if position < 0.5 {
						result.keyPosition = 6
					} else if position < 0.7 {
						result.keyPosition = 3
					}
				} else {
					if position > 0.7 {
						result.keyPosition = 10
					} else if position > 0.5 {
						result.keyPosition = 6
					} else if position > 0.3 {
						result.keyPosition = 3
					}
				}

				if result.keyPosition > 0 {
					break
				}
			}
		}

		// 检查EMA支撑/阻力
		if len(data.EMA20Values) > 0 && len(data.EMA50Values) > 0 {
			ema20 := data.EMA20Values[len(data.EMA20Values)-1]
			ema50 := data.EMA50Values[len(data.EMA50Values)-1]
			close := latestKline.Close

			if isLong {
				ema20Dist := (close - ema20) / ema20 * 100
				ema50Dist := (close - ema50) / ema50 * 100

				if ema20Dist < 0.5 && ema20Dist > -0.5 {
					result.keyPosition = 8
				} else if ema50Dist < 1 && ema50Dist > -1 {
					result.keyPosition = 6
				}
			} else {
				ema20Dist := (close - ema20) / ema20 * 100
				ema50Dist := (close - ema50) / ema50 * 100

				if ema20Dist < 0.5 && ema20Dist > -0.5 {
					result.keyPosition = 8
				} else if ema50Dist < 1 && ema50Dist > -1 && close < ema50 {
					result.keyPosition = 6
				}
			}

			if result.keyPosition > 0 {
				break
			}
		}
	}

	result.total = result.trendConsist + result.keyPosition
	return result
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
