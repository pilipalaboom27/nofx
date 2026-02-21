import { useState } from 'react'
import type { DecisionRecord, DecisionAction, SignalScore, TrendAnalysis } from '../types'
import { t, type Language } from '../i18n/translations'

interface DecisionCardProps {
  decision: DecisionRecord
  language: Language
  onSymbolClick?: (symbol: string) => void
}

// Action type configuration
const ACTION_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  open_long: { color: '#0ECB81', bg: 'rgba(14, 203, 129, 0.15)', icon: '📈', label: 'LONG' },
  open_short: { color: '#F6465D', bg: 'rgba(246, 70, 93, 0.15)', icon: '📉', label: 'SHORT' },
  close_long: { color: '#F0B90B', bg: 'rgba(240, 185, 11, 0.15)', icon: '💰', label: 'CLOSE' },
  close_short: { color: '#F0B90B', bg: 'rgba(240, 185, 11, 0.15)', icon: '💰', label: 'CLOSE' },
  hold: { color: '#848E9C', bg: 'rgba(132, 142, 156, 0.15)', icon: '⏸️', label: 'HOLD' },
  wait: { color: '#848E9C', bg: 'rgba(132, 142, 156, 0.15)', icon: '⏳', label: 'WAIT' },
}

// Format price with proper decimals
function formatPrice(price: number | undefined): string {
  if (!price || price === 0) return '-'
  if (price >= 1000) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

// Calculate percentage change
function calcPctChange(entry: number | undefined, target: number | undefined, isLong: boolean): string {
  if (!entry || !target || entry === 0) return '-'
  const pct = ((target - entry) / entry) * 100
  const adjustedPct = isLong ? pct : -pct
  return `${adjustedPct >= 0 ? '+' : ''}${adjustedPct.toFixed(2)}%`
}

// Get confidence color
function getConfidenceColor(confidence: number | undefined): string {
  if (!confidence) return '#848E9C'
  if (confidence >= 80) return '#0ECB81'
  if (confidence >= 60) return '#F0B90B'
  return '#F6465D'
}

// Get signal score color
function getSignalScoreColor(score: number): string {
  if (score >= 70) return '#0ECB81'
  if (score >= 50) return '#F0B90B'
  return '#F6465D'
}

// Get trend direction icon and color
function getTrendDisplay(direction: string): { icon: string; color: string; label: string } {
  switch (direction?.toLowerCase()) {
    case 'up':
    case 'uptrend':
      return { icon: '📈', color: '#0ECB81', label: 'UP' }
    case 'down':
    case 'downtrend':
      return { icon: '📉', color: '#F6465D', label: 'DOWN' }
    default:
      return { icon: '➡️', color: '#848E9C', label: 'SIDEWAYS' }
  }
}

// Signal Score Display Component
function SignalScoreDisplay({ score, language }: { score: SignalScore; language: Language }) {
  const scoreColor = getSignalScoreColor(score.total)

  return (
    <div
      className="rounded-lg p-3 mb-2"
      style={{ background: 'rgba(14, 203, 129, 0.05)', border: '1px solid rgba(14, 203, 129, 0.2)' }}
    >
      {/* Header with total score */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: '#848E9C' }}>
          {language === 'zh' ? '📊 信号评分' : '📊 Signal Score'}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-xl" style={{ color: scoreColor }}>
            {score.total}
          </span>
          <span className="text-xs" style={{ color: '#848E9C' }}>/100</span>
        </div>
      </div>

      {/* Main score breakdown - 4 dimensions */}
      <div className="grid grid-cols-4 gap-2 text-xs mb-3">
        <div className="text-center p-2 rounded" style={{ background: 'rgba(96, 165, 250, 0.1)' }}>
          <div className="font-mono font-bold text-base" style={{ color: '#60a5fa' }}>{score.rsi_score}</div>
          <div style={{ color: '#848E9C' }}>RSI</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#60a5fa' }}>
            {score.rsi_value !== undefined ? score.rsi_value.toFixed(1) : '-'}
          </div>
        </div>
        <div className="text-center p-2 rounded" style={{ background: 'rgba(14, 203, 129, 0.1)' }}>
          <div className="font-mono font-bold text-base" style={{ color: '#0ECB81' }}>{score.ema_score}</div>
          <div style={{ color: '#848E9C' }}>EMA</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#0ECB81' }}>
            /23
          </div>
        </div>
        <div className="text-center p-2 rounded" style={{ background: 'rgba(240, 185, 11, 0.1)' }}>
          <div className="font-mono font-bold text-base" style={{ color: '#F0B90B' }}>{score.volume_price_score}</div>
          <div style={{ color: '#848E9C' }}>{language === 'zh' ? '量价' : 'Vol'}</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#F0B90B' }}>
            /20
          </div>
        </div>
        <div className="text-center p-2 rounded" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
          <div className="font-mono font-bold text-base" style={{ color: '#a855f7' }}>{score.multi_tf_score}</div>
          <div style={{ color: '#848E9C' }}>{language === 'zh' ? '多周期' : 'TF'}</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#a855f7' }}>
            /30
          </div>
        </div>
      </div>

      {/* EMA sub-scores */}
      {(score.ema_position !== undefined || score.ema_slope !== undefined || score.ema_alignment !== undefined) && (
        <div className="mb-2 p-2 rounded text-xs" style={{ background: 'rgba(14, 203, 129, 0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: '#0ECB81' }}>📈 EMA详情</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="font-mono" style={{ color: '#EAECEF' }}>{score.ema_position ?? 0}<span className="text-[10px]" style={{ color: '#848E9C' }}>/8</span></div>
              <div style={{ color: '#848E9C' }}>{language === 'zh' ? '位置' : 'Position'}</div>
            </div>
            <div className="text-center">
              <div className="font-mono" style={{ color: '#EAECEF' }}>{score.ema_slope ?? 0}<span className="text-[10px]" style={{ color: '#848E9C' }}>/8</span></div>
              <div style={{ color: '#848E9C' }}>{language === 'zh' ? '斜率' : 'Slope'}</div>
            </div>
            <div className="text-center">
              <div className="font-mono" style={{ color: '#EAECEF' }}>{score.ema_alignment ?? 0}<span className="text-[10px]" style={{ color: '#848E9C' }}>/7</span></div>
              <div style={{ color: '#848E9C' }}>{language === 'zh' ? '排列' : 'Align'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Volume-Price sub-scores */}
      {(score.oi_change !== undefined || score.volume_confirm !== undefined) && (
        <div className="mb-2 p-2 rounded text-xs" style={{ background: 'rgba(240, 185, 11, 0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: '#F0B90B' }}>📊 {language === 'zh' ? '量价详情' : 'Vol-Price'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="font-mono" style={{ color: '#EAECEF' }}>{score.oi_change ?? 0}<span className="text-[10px]" style={{ color: '#848E9C' }}>/12</span></div>
              <div style={{ color: '#848E9C' }}>OI{language === 'zh' ? '变化' : 'Change'}</div>
              {score.oi_change_pct !== undefined && (
                <div className="text-[10px]" style={{ color: score.oi_change_pct > 0 ? '#0ECB81' : '#F6465D' }}>
                  {score.oi_change_pct > 0 ? '+' : ''}{score.oi_change_pct.toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="font-mono" style={{ color: '#EAECEF' }}>{score.volume_confirm ?? 0}<span className="text-[10px]" style={{ color: '#848E9C' }}>/8</span></div>
              <div style={{ color: '#848E9C' }}>{language === 'zh' ? '成交量' : 'Volume'}</div>
              {score.volume_ratio !== undefined && (
                <div className="text-[10px]" style={{ color: score.volume_ratio > 1 ? '#0ECB81' : '#848E9C' }}>
                  {score.volume_ratio.toFixed(2)}x
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-TF sub-scores */}
      {(score.trend_consist !== undefined || score.key_position !== undefined) && (
        <div className="mb-2 p-2 rounded text-xs" style={{ background: 'rgba(168, 85, 247, 0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: '#a855f7' }}>🔄 {language === 'zh' ? '多周期详情' : 'Multi-TF'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="font-mono" style={{ color: '#EAECEF' }}>{score.trend_consist ?? 0}<span className="text-[10px]" style={{ color: '#848E9C' }}>/20</span></div>
              <div style={{ color: '#848E9C' }}>{language === 'zh' ? '趋势一致' : 'Trend'}</div>
              {score.trend_tf_count !== undefined && score.trend_direction && (
                <div className="text-[10px]" style={{ color: score.trend_direction === 'up' ? '#0ECB81' : score.trend_direction === 'down' ? '#F6465D' : '#848E9C' }}>
                  {score.trend_tf_count} TF {score.trend_direction === 'up' ? '↑' : score.trend_direction === 'down' ? '↓' : '→'}
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="font-mono" style={{ color: '#EAECEF' }}>{score.key_position ?? 0}<span className="text-[10px]" style={{ color: '#848E9C' }}>/10</span></div>
              <div style={{ color: '#848E9C' }}>{language === 'zh' ? '关键位置' : 'Key Pos'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Score bar */}
      <div className="mt-2 h-2 rounded-full" style={{ background: '#2B3139' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${score.total}%`,
            background: scoreColor
          }}
        />
      </div>
    </div>
  )
}

// Trend Analysis Display Component
function TrendAnalysisDisplay({ analysis, language }: { analysis: TrendAnalysis; language: Language }) {
  const trend = getTrendDisplay(analysis.direction)

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'rgba(96, 165, 250, 0.05)', border: '1px solid rgba(96, 165, 250, 0.2)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: '#848E9C' }}>
          {language === 'zh' ? '📈 趋势分析' : '📈 Trend Analysis'}
        </span>
        <div className="flex items-center gap-2">
          <span>{trend.icon}</span>
          <span className="font-medium" style={{ color: trend.color }}>{trend.label}</span>
          <span className="text-xs" style={{ color: '#848E9C' }}>
            ({analysis.strength}%)
          </span>
        </div>
      </div>

      {/* Trend details */}
      <div className="flex flex-wrap gap-2 text-xs">
        {analysis.is_confirmed !== undefined && (
          <span
            className="px-2 py-0.5 rounded"
            style={{
              background: analysis.is_confirmed ? 'rgba(14, 203, 129, 0.15)' : 'rgba(246, 70, 93, 0.15)',
              color: analysis.is_confirmed ? '#0ECB81' : '#F6465D'
            }}
          >
            {analysis.is_confirmed
              ? (language === 'zh' ? '✓ 多周期确认' : '✓ Multi-TF Confirmed')
              : (language === 'zh' ? '✗ 未确认' : '✗ Not Confirmed')}
          </span>
        )}
        {analysis.ema_alignment && (
          <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(132, 142, 156, 0.15)', color: '#848E9C' }}>
            EMA: {analysis.ema_alignment}
          </span>
        )}
        {analysis.primary_tf && analysis.confirm_tf && (
          <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(132, 142, 156, 0.15)', color: '#848E9C' }}>
            {analysis.primary_tf} + {analysis.confirm_tf}
          </span>
        )}
      </div>

      {/* Strength bar */}
      <div className="mt-2 h-1.5 rounded-full" style={{ background: '#2B3139' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${analysis.strength}%`,
            background: trend.color
          }}
        />
      </div>
    </div>
  )
}

// Single Action Card Component
function ActionCard({ action, language, onSymbolClick }: { action: DecisionAction; language: Language; onSymbolClick?: (symbol: string) => void }) {
  const config = ACTION_CONFIG[action.action] || ACTION_CONFIG.wait
  const isLong = action.action.includes('long')
  const isOpen = action.action.includes('open')

  return (
    <div
      className="rounded-lg p-4 transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: 'linear-gradient(135deg, #1E2329 0%, #181C21 100%)',
        border: `1px solid ${config.color}33`,
        boxShadow: `0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)`,
      }}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">{config.icon}</span>
          <span
            className="font-mono font-bold text-lg cursor-pointer transition-all duration-200 hover:scale-110"
            style={{ color: '#EAECEF' }}
            onClick={() => onSymbolClick?.(action.symbol)}
            title="Click to view chart"
          >
            {action.symbol.replace('USDT', '')}
          </span>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}55` }}
          >
            {config.label}
          </span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {action.confidence !== undefined && action.confidence > 0 && (
            <div
              className="px-2 py-1 rounded text-xs font-semibold"
              style={{
                background: `${getConfidenceColor(action.confidence)}22`,
                color: getConfidenceColor(action.confidence)
              }}
            >
              {action.confidence.toFixed(0)}%
            </div>
          )}
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: action.success ? '#0ECB81' : '#F6465D' }}
          />
        </div>
      </div>

      {/* Trading Details Grid */}
      {isOpen && (
        <div className="grid grid-cols-4 gap-3 mt-3 pt-3" style={{ borderTop: '1px solid #2B3139' }}>
          {/* Entry Price */}
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#848E9C' }}>
              {t('entryPrice', language)}
            </div>
            <div className="font-mono font-semibold" style={{ color: '#EAECEF' }}>
              {formatPrice(action.price)}
            </div>
          </div>

          {/* Stop Loss */}
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#F6465D' }}>
              {t('stopLoss', language)}
            </div>
            <div className="font-mono font-semibold" style={{ color: '#F6465D' }}>
              {formatPrice(action.stop_loss)}
            </div>
            {action.stop_loss && action.price && (
              <div className="text-xs mt-0.5" style={{ color: '#848E9C' }}>
                {calcPctChange(action.price, action.stop_loss, isLong)}
              </div>
            )}
          </div>

          {/* Take Profit */}
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#0ECB81' }}>
              {t('takeProfit', language)}
            </div>
            <div className="font-mono font-semibold" style={{ color: '#0ECB81' }}>
              {formatPrice(action.take_profit)}
            </div>
            {action.take_profit && action.price && (
              <div className="text-xs mt-0.5" style={{ color: '#848E9C' }}>
                {calcPctChange(action.price, action.take_profit, isLong)}
              </div>
            )}
          </div>

          {/* Leverage */}
          <div className="text-center">
            <div className="text-xs mb-1" style={{ color: '#848E9C' }}>
              {t('leverage', language)}
            </div>
            <div className="font-mono font-semibold" style={{ color: '#F0B90B' }}>
              {action.leverage}x
            </div>
          </div>
        </div>
      )}

      {/* Risk/Reward Ratio for open positions */}
      {isOpen && action.stop_loss && action.take_profit && action.price && (
        <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid #2B3139' }}>
          <span className="text-xs" style={{ color: '#848E9C' }}>{t('riskReward', language)}</span>
          <div className="flex items-center gap-2">
            {(() => {
              const slDist = Math.abs(action.price - action.stop_loss)
              const tpDist = Math.abs(action.take_profit - action.price)
              const ratio = slDist > 0 ? (tpDist / slDist) : 0
              const ratioColor = ratio >= 3 ? '#0ECB81' : ratio >= 2 ? '#F0B90B' : '#F6465D'
              return (
                <>
                  <div className="flex gap-1">
                    <span style={{ color: '#F6465D' }}>1</span>
                    <span style={{ color: '#848E9C' }}>:</span>
                    <span style={{ color: '#0ECB81' }}>{ratio.toFixed(1)}</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: '60px',
                      background: '#2B3139',
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(ratio / 5 * 100, 100)}%`,
                        background: ratioColor
                      }}
                    />
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Reasoning */}
      {action.reasoning && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2B3139' }}>
          <div className="text-xs line-clamp-2" style={{ color: '#848E9C' }}>
            💡 {action.reasoning}
          </div>
        </div>
      )}

      {/* Error Message */}
      {action.error && (
        <div
          className="mt-3 rounded p-2 text-xs"
          style={{
            background: 'rgba(246, 70, 93, 0.1)',
            border: '1px solid rgba(246, 70, 93, 0.3)',
            color: '#F6465D',
          }}
        >
          ❌ {action.error}
        </div>
      )}

      {/* Validation Result */}
      {action.validation_result && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2B3139' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">
              {action.validation_result.passed ? '✅' : '❌'}
            </span>
            <span className="text-xs font-medium" style={{ color: '#848E9C' }}>
              {action.validation_result.passed
                ? (language === 'zh' ? '验证通过' : 'Validation Passed')
                : (language === 'zh' ? '验证失败' : 'Validation Failed')}
            </span>
            {action.validation_result.validation_error && (
              <span className="text-xs" style={{ color: '#F6465D' }}>
                - {action.validation_result.validation_error}
              </span>
            )}
          </div>

          {/* Signal Score */}
          {action.validation_result.signal_score && (
            <SignalScoreDisplay
              score={action.validation_result.signal_score}
              language={language}
            />
          )}

          {/* Trend Analysis */}
          {action.validation_result.trend_analysis && (
            <TrendAnalysisDisplay
              analysis={action.validation_result.trend_analysis}
              language={language}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function DecisionCard({ decision, language, onSymbolClick }: DecisionCardProps) {
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [showInputPrompt, setShowInputPrompt] = useState(false)
  const [showCoT, setShowCoT] = useState(false)

  // Copy text to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert(`${label} copied!`)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Download text as file
  const downloadAsFile = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="rounded-xl p-5 transition-all duration-300 hover:translate-y-[-2px]"
      style={{
        border: '1px solid #2B3139',
        background: 'linear-gradient(180deg, #1E2329 0%, #181C21 100%)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(240, 185, 11, 0.15)' }}
          >
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <div className="font-bold" style={{ color: '#EAECEF' }}>
              {t('cycle', language)} #{decision.cycle_number}
            </div>
            <div className="text-xs" style={{ color: '#848E9C' }}>
              {new Date(decision.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
        <div
          className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wider"
          style={
            decision.success
              ? { background: 'rgba(14, 203, 129, 0.15)', color: '#0ECB81', border: '1px solid rgba(14, 203, 129, 0.3)' }
              : { background: 'rgba(246, 70, 93, 0.15)', color: '#F6465D', border: '1px solid rgba(246, 70, 93, 0.3)' }
          }
        >
          {t(decision.success ? 'success' : 'failed', language)}
        </div>
      </div>

      {/* Decision Actions - Beautiful Grid */}
      {decision.decisions && decision.decisions.length > 0 && (
        <div className="space-y-3 mb-4">
          {decision.decisions.map((action, index) => (
            <ActionCard key={`${action.symbol}-${index}`} action={action} language={language} onSymbolClick={onSymbolClick} />
          ))}
        </div>
      )}

      {/* Collapsible Sections */}
      <div className="space-y-2">
        {/* System Prompt */}
        {decision.system_prompt && (
          <div>
            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className="flex items-center gap-2 text-sm transition-colors w-full justify-between p-2 rounded hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">⚙️</span>
                <span className="font-semibold" style={{ color: '#a78bfa' }}>
                  System Prompt
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copyToClipboard(decision.system_prompt, 'System Prompt')
                  }}
                  className="text-xs px-2.5 py-1 rounded hover:opacity-80 transition-opacity flex items-center gap-1"
                  style={{ background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.3)' }}
                  title="Copy to clipboard"
                >
                  <span>📋</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadAsFile(decision.system_prompt, `system-prompt-cycle-${decision.cycle_number}.txt`)
                  }}
                  className="text-xs px-2.5 py-1 rounded hover:opacity-80 transition-opacity flex items-center gap-1"
                  style={{ background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.3)' }}
                  title="Download as file"
                >
                  <span>💾</span>
                </button>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' }}
                >
                  {showSystemPrompt ? t('collapse', language) : t('expand', language)}
                </span>
              </div>
            </button>
            {showSystemPrompt && (
              <div
                className="mt-2 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
                style={{
                  background: '#0B0E11',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                }}
              >
                {decision.system_prompt}
              </div>
            )}
          </div>
        )}

        {/* User/Input Prompt */}
        {decision.input_prompt && (
          <div>
            <button
              onClick={() => setShowInputPrompt(!showInputPrompt)}
              className="flex items-center gap-2 text-sm transition-colors w-full justify-between p-2 rounded hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">📥</span>
                <span className="font-semibold" style={{ color: '#60a5fa' }}>
                  User Prompt
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copyToClipboard(decision.input_prompt, 'User Prompt')
                  }}
                  className="text-xs px-2.5 py-1 rounded hover:opacity-80 transition-opacity flex items-center gap-1"
                  style={{ background: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)' }}
                  title="Copy to clipboard"
                >
                  <span>📋</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadAsFile(decision.input_prompt, `user-prompt-cycle-${decision.cycle_number}.txt`)
                  }}
                  className="text-xs px-2.5 py-1 rounded hover:opacity-80 transition-opacity flex items-center gap-1"
                  style={{ background: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)' }}
                  title="Download as file"
                >
                  <span>💾</span>
                </button>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }}
                >
                  {showInputPrompt ? t('collapse', language) : t('expand', language)}
                </span>
              </div>
            </button>
            {showInputPrompt && (
              <div
                className="mt-2 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
                style={{
                  background: '#0B0E11',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                }}
              >
                {decision.input_prompt}
              </div>
            )}
          </div>
        )}

        {/* AI Thinking */}
        {decision.cot_trace && (
          <div>
            <button
              onClick={() => setShowCoT(!showCoT)}
              className="flex items-center gap-2 text-sm transition-colors w-full justify-between p-2 rounded hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🧠</span>
                <span className="font-semibold" style={{ color: '#F0B90B' }}>
                  {t('aiThinking', language)}
                </span>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(240, 185, 11, 0.15)', color: '#F0B90B' }}
              >
                {showCoT ? t('collapse', language) : t('expand', language)}
              </span>
            </button>
            {showCoT && (
              <div
                className="mt-2 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
                style={{
                  background: '#0B0E11',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                }}
              >
                {decision.cot_trace}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Execution Log */}
      {decision.execution_log && decision.execution_log.length > 0 && (
        <div
          className="rounded-lg p-3 mt-4 text-xs font-mono space-y-1"
          style={{ background: '#0B0E11', border: '1px solid #2B3139' }}
        >
          {decision.execution_log.map((log, index) => (
            <div key={`${log}-${index}`} style={{ color: '#EAECEF' }}>
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Error Message */}
      {decision.error_message && (
        <div
          className="rounded-lg p-3 mt-4 text-sm"
          style={{
            background: 'rgba(246, 70, 93, 0.1)',
            border: '1px solid rgba(246, 70, 93, 0.4)',
            color: '#F6465D',
          }}
        >
          ❌ {decision.error_message}
        </div>
      )}
    </div>
  )
}
