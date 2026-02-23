import { TrendingUp, Filter, BarChart3, Target, Info, AlertTriangle } from 'lucide-react'
import type { ConservativeStrategyConfig } from '../../types'

interface ConservativeStrategyEditorProps {
  config: ConservativeStrategyConfig | undefined
  onChange: (config: ConservativeStrategyConfig) => void
  disabled?: boolean
  language: string
}

export function ConservativeStrategyEditor({
  config,
  onChange,
  disabled,
  language,
}: ConservativeStrategyEditorProps) {
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      // Header
      title: { zh: '保守策略设置', en: 'Conservative Strategy Settings' },
      subtitle: { zh: '追求少而精的交易，通过严格筛选提高胜率', en: 'Focus on fewer but higher quality trades to improve win rate' },

      // Daily Limits
      dailyLimits: { zh: '日频限制', en: 'Daily Limits' },
      dailyLimitsDesc: { zh: '限制每日交易次数和亏损额度，防止过度交易', en: 'Limit daily trade count and loss to prevent overtrading' },
      enableDailyLimits: { zh: '启用日频限制', en: 'Enable Daily Limits' },
      maxDailyTrades: { zh: '每日最大交易次数', en: 'Max Daily Trades' },
      maxDailyLossPct: { zh: '每日最大亏损比例', en: 'Max Daily Loss %' },
      maxDailyLossTip: { zh: '负数，如-5表示亏损5%时停止交易', en: 'Negative value, e.g., -5 means stop trading at 5% loss' },
      tradesUnit: { zh: '次', en: 'trades' },

      // Signal Scoring
      signalScoring: { zh: '信号质量评分', en: 'Signal Quality Scoring' },
      signalScoringDesc: { zh: '对交易信号进行综合评分，只接受高质量信号', en: 'Score trading signals and only accept high-quality ones' },
      enableSignalScoring: { zh: '启用信号评分', en: 'Enable Signal Scoring' },
      minSignalScore: { zh: '最低信号分数', en: 'Min Signal Score' },
      minSignalScoreTip: { zh: '0-100分，低于此分数的信号将被拒绝', en: '0-100, signals below this score will be rejected' },
      scoringRules: { zh: '评分规则', en: 'Scoring Rules' },
      rsiScore: { zh: 'RSI位置 (25分): 超卖区做多/超买区做空得分高', en: 'RSI Position (25pts): Higher scores at oversold(buy)/overbought(sell)' },
      emaScore: { zh: 'EMA趋势 (25分): 顺势交易得分高', en: 'EMA Trend (25pts): Higher scores for trend-aligned trades' },
      vpScore: { zh: '量价配合 (20分): OI与价格同向变化得分高', en: 'Volume-Price (20pts): OI confirming price direction' },
      mtfScore: { zh: '多周期共振 (30分): 15M/1H/4H趋势一致得分高', en: 'Multi-Timeframe (30pts): 15M/1H/4H alignment' },

      // Trend Confirmation
      trendConfirm: { zh: '趋势确认', en: 'Trend Confirmation' },
      trendConfirmDesc: { zh: '验证交易是否顺势，拒绝逆势交易', en: 'Verify trades follow the trend, reject counter-trend trades' },
      enableTrendConfirm: { zh: '启用趋势确认', en: 'Enable Trend Confirmation' },
      requireMultiTF: { zh: '要求多周期确认', en: 'Require Multi-Timeframe Confirmation' },
      requireMultiTFTip: { zh: '15M + 1H趋势一致时才允许交易', en: 'Only trade when 15M + 1H trends align' },
      counterTrendWarning: { zh: '启用后将拒绝所有逆势交易', en: 'Counter-trend trades will be rejected when enabled' },

      // Trailing Stop
      trailingStop: { zh: '移动止损', en: 'Trailing Stop' },
      trailingStopDesc: { zh: '盈利达到阈值后追踪最高点，回撤时触发止损，锁定利润', en: 'Track peak price after profit threshold, trigger stop on drawdown to lock gains' },
      enableTrailingStop: { zh: '启用移动止损', en: 'Enable Trailing Stop' },
      trailTriggerPct: { zh: '触发追踪阈值', en: 'Trigger Threshold' },
      trailTriggerTip: { zh: '盈利达到此%时开始追踪最高点', en: 'Start tracking peak when profit reaches this %' },
      trailDrawdownPct: { zh: '回撤止损%', en: 'Drawdown Stop %' },
      trailDrawdownTip: { zh: '从最高点回撤此%时触发止损', en: 'Trigger stop when price retreats this % from peak' },
      trailingExample: { zh: '示例：盈利5%触发追踪，回撤3%止损 → 盈利10%后回撤到6.7%止损', en: 'Example: 5% triggers tracking, 3% drawdown stops → At 10% peak, stops at 6.7%' },

      // General
      codeEnforced: { zh: '代码强制执行', en: 'CODE ENFORCED' },
      recommended: { zh: '推荐值', en: 'Recommended' },
      percent: { zh: '%', en: '%' },
      points: { zh: '分', en: 'pts' },
    }
    return translations[key]?.[language] || key
  }

  // Default config if not provided
  const conservative: ConservativeStrategyConfig = config || {
    enable_daily_limits: false,
    max_daily_trades: 3,
    max_daily_loss_pct: -5,
    enable_signal_scoring: false,
    min_signal_score: 60,
    enable_trend_confirm: false,
    require_multi_timeframe: true,
    enable_trailing_stop: false,
    trail_trigger_pct: 5,
    trail_drawdown_pct: 3,
  }

  const updateField = <K extends keyof ConservativeStrategyConfig>(
    key: K,
    value: ConservativeStrategyConfig[K]
  ) => {
    if (!disabled) {
      onChange({ ...conservative, [key]: value })
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with explanation */}
      <div className="p-3 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
          <div>
            <p className="text-sm" style={{ color: '#EAECEF' }}>{t('subtitle')}</p>
            <p className="text-xs mt-1" style={{ color: '#848E9C' }}>
              {language === 'zh'
                ? '这些规则由后端代码强制执行，AI无法绕过。所有功能默认关闭。'
                : 'These rules are enforced by backend code, AI cannot bypass. All features are off by default.'}
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Daily Limits */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#0B0E11', border: '1px solid #2B3139' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" style={{ color: '#10b981' }} />
              <span className="font-medium" style={{ color: '#EAECEF' }}>{t('dailyLimits')}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={conservative.enable_daily_limits}
                onChange={(e) => updateField('enable_daily_limits', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('enableDailyLimits')}</span>
            </label>
          </div>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('dailyLimitsDesc')}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('maxDailyTrades')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={conservative.max_daily_trades}
                  onChange={(e) => updateField('max_daily_trades', parseInt(e.target.value) || 3)}
                  disabled={disabled || !conservative.enable_daily_limits}
                  min={1}
                  max={20}
                  className="w-20 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: '#1E2329',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: conservative.enable_daily_limits ? 1 : 0.5,
                  }}
                />
                <span className="text-xs" style={{ color: '#848E9C' }}>{t('tradesUnit')}</span>
              </div>
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('maxDailyLossPct')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={conservative.max_daily_loss_pct}
                  onChange={(e) => updateField('max_daily_loss_pct', parseFloat(e.target.value) || -5)}
                  disabled={disabled || !conservative.enable_daily_limits}
                  min={-20}
                  max={0}
                  step={0.5}
                  className="w-20 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: '#1E2329',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: conservative.enable_daily_limits ? 1 : 0.5,
                  }}
                />
                <span className="text-xs" style={{ color: '#848E9C' }}>{t('percent')}</span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>{t('maxDailyLossTip')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Signal Quality Scoring */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#0B0E11', border: '1px solid #2B3139' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" style={{ color: '#10b981' }} />
              <span className="font-medium" style={{ color: '#EAECEF' }}>{t('signalScoring')}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={conservative.enable_signal_scoring}
                onChange={(e) => updateField('enable_signal_scoring', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('enableSignalScoring')}</span>
            </label>
          </div>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('signalScoringDesc')}</p>

          <div className="mb-3">
            <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('minSignalScore')}</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={conservative.min_signal_score}
                onChange={(e) => updateField('min_signal_score', parseInt(e.target.value) || 60)}
                disabled={disabled || !conservative.enable_signal_scoring}
                min={0}
                max={100}
                className="w-20 px-3 py-2 rounded-lg text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: conservative.enable_signal_scoring ? 1 : 0.5,
                }}
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('points')}</span>
              <span className="text-xs px-2 py-1 rounded" style={{ background: '#1E2329', color: '#0ECB81' }}>
                {t('recommended')}: 60
              </span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>{t('minSignalScoreTip')}</p>
          </div>

          <div className="p-3 rounded-lg" style={{ background: '#1E2329' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#EAECEF' }}>{t('scoringRules')}:</p>
            <ul className="text-[11px] space-y-1" style={{ color: '#848E9C' }}>
              <li>• {t('rsiScore')}</li>
              <li>• {t('emaScore')}</li>
              <li>• {t('vpScore')}</li>
              <li>• {t('mtfScore')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 3: Trend Confirmation */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#0B0E11', border: '1px solid #2B3139' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: '#10b981' }} />
              <span className="font-medium" style={{ color: '#EAECEF' }}>{t('trendConfirm')}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={conservative.enable_trend_confirm}
                onChange={(e) => updateField('enable_trend_confirm', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('enableTrendConfirm')}</span>
            </label>
          </div>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('trendConfirmDesc')}</p>

          <div className="flex items-start gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={conservative.require_multi_timeframe}
                onChange={(e) => updateField('require_multi_timeframe', e.target.checked)}
                disabled={disabled || !conservative.enable_trend_confirm}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('requireMultiTF')}</span>
            </label>
          </div>
          <p className="text-[10px] mt-1 mb-3" style={{ color: '#848E9C' }}>{t('requireMultiTFTip')}</p>

          <div className="p-2 rounded flex items-center gap-2" style={{ background: 'rgba(246, 70, 93, 0.1)', border: '1px solid rgba(246, 70, 93, 0.3)' }}>
            <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: '#F6465D' }} />
            <span className="text-[11px]" style={{ color: '#F6465D' }}>{t('counterTrendWarning')}</span>
          </div>
        </div>
      </div>

      {/* Section 4: Trailing Stop */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#0B0E11', border: '1px solid #0ECB81' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" style={{ color: '#0ECB81' }} />
              <span className="font-medium" style={{ color: '#EAECEF' }}>{t('trailingStop')}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={conservative.enable_trailing_stop}
                onChange={(e) => updateField('enable_trailing_stop', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('enableTrailingStop')}</span>
            </label>
          </div>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('trailingStopDesc')}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('trailTriggerPct')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={conservative.trail_trigger_pct}
                  onChange={(e) => updateField('trail_trigger_pct', parseFloat(e.target.value) || 5)}
                  disabled={disabled || !conservative.enable_trailing_stop}
                  min={1}
                  max={20}
                  step={0.5}
                  className="w-20 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: '#1E2329',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: conservative.enable_trailing_stop ? 1 : 0.5,
                  }}
                />
                <span className="text-xs" style={{ color: '#848E9C' }}>{t('percent')}</span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>{t('trailTriggerTip')}</p>
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('trailDrawdownPct')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={conservative.trail_drawdown_pct}
                  onChange={(e) => updateField('trail_drawdown_pct', parseFloat(e.target.value) || 3)}
                  disabled={disabled || !conservative.enable_trailing_stop}
                  min={0.5}
                  max={10}
                  step={0.5}
                  className="w-20 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: '#1E2329',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: conservative.enable_trailing_stop ? 1 : 0.5,
                  }}
                />
                <span className="text-xs" style={{ color: '#848E9C' }}>{t('percent')}</span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>{t('trailDrawdownTip')}</p>
            </div>
          </div>

          <div className="p-2 rounded mt-3 flex items-center gap-2" style={{ background: 'rgba(14, 203, 129, 0.1)', border: '1px solid rgba(14, 203, 129, 0.3)' }}>
            <Info className="w-3 h-3 flex-shrink-0" style={{ color: '#0ECB81' }} />
            <span className="text-[11px]" style={{ color: '#0ECB81' }}>{t('trailingExample')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
