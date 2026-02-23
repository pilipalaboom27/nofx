import { Clock, TrendingUp, Lock, AlertTriangle, Info } from 'lucide-react'
import type { TradingDisciplineConfig } from '../../types'

interface TradingDisciplineEditorProps {
  config: TradingDisciplineConfig | undefined
  onChange: (config: TradingDisciplineConfig) => void
  disabled?: boolean
  language: string
}

export function TradingDisciplineEditor({
  config,
  onChange,
  disabled,
  language,
}: TradingDisciplineEditorProps) {
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      // Header
      title: { zh: '交易纪律设置', en: 'Trading Discipline Settings' },
      subtitle: { zh: '强制执行交易纪律，防止过早平仓和追涨杀跌', en: 'Enforce trading discipline to prevent early closes and chasing' },

      // Min Holding Time
      minHoldingTime: { zh: '最小持仓时间', en: 'Min Holding Time' },
      minHoldingTimeDesc: { zh: '持仓必须满足最短时间，除非触发止损或亏损超过阈值。这可以防止AI因为短期波动而过早平仓。', en: 'Positions must be held for minimum time unless stop-loss triggers or loss exceeds threshold. Prevents AI from closing too early due to short-term fluctuations.' },
      enable: { zh: '启用', en: 'Enable' },
      minutes: { zh: '分钟', en: 'minutes' },
      minHoldingTimeTip: { zh: '建议设置 30-60 分钟，给交易策略足够时间发展', en: 'Recommend 30-60 minutes to give trades time to develop' },

      // Entry Indicators
      entryIndicators: { zh: '开仓指标验证', en: 'Entry Indicator Validation' },
      entryIndicatorsDesc: { zh: '基于技术指标验证开仓决策，防止在极端价格位置追涨杀跌。', en: 'Validate entries based on technical indicators to prevent chasing at extreme price levels.' },
      maxRSIForLong: { zh: '做多最大RSI', en: 'Max RSI for Long' },
      maxRSIForLongTip: { zh: 'RSI超过此值时禁止做多（超买区域，追高风险大）', en: 'Reject long when RSI exceeds this value (overbought, high chasing risk)' },
      minRSIForShort: { zh: '做空最小RSI', en: 'Min RSI for Short' },
      minRSIForShortTip: { zh: 'RSI低于此值时禁止做空（超卖区域，杀跌风险大）', en: 'Reject short when RSI is below this value (oversold, high chasing risk)' },
      maxPriceDeviation: { zh: '价格偏离EMA上限', en: 'Max Price Deviation from EMA' },
      maxPriceDeviationTip: { zh: '价格偏离EMA20超过此百分比时禁止开仓，防止追极端行情', en: 'Reject entry when price deviates from EMA20 beyond this percentage' },

      // Mandatory SL/TP
      mandatorySLTP: { zh: '强制止损止盈', en: 'Mandatory Stop-Loss/Take-Profit' },
      mandatorySLTPDesc: { zh: '要求所有新仓位必须设置止损和止盈价格，确保每笔交易都有明确的风险控制计划。', en: 'Require all new positions to have stop-loss and take-profit prices, ensuring every trade has a clear risk management plan.' },
      requireStopLoss: { zh: '强制止损', en: 'Require Stop-Loss' },
      requireTakeProfit: { zh: '强制止盈', en: 'Require Take-Profit' },

      // Close Restrictions
      closeRestrictions: { zh: '平仓限制', en: 'Close Restrictions' },
      closeRestrictionsDesc: { zh: '限制AI随意平仓，要求提供详细的平仓理由。这可以防止AI因为短期情绪而做出冲动决策。', en: 'Restrict arbitrary closes by AI, requiring detailed reasoning. Prevents impulsive decisions based on short-term emotions.' },
      minLossForEarlyClose: { zh: '允许提前平仓亏损阈值', en: 'Min Loss for Early Close' },
      minLossForEarlyCloseTip: { zh: '亏损超过此百分比时允许提前平仓（负数，如-3表示亏损3%）', en: 'Allow early close when loss exceeds this percentage (negative, e.g., -3 means 3% loss)' },
      closeReasoningMinLength: { zh: '平仓理由最少字数', en: 'Min Close Reasoning Length' },
      closeReasoningMinLengthTip: { zh: 'AI必须提供足够详细的平仓理由', en: 'AI must provide sufficiently detailed close reasoning' },

      // General
      codeEnforced: { zh: '代码强制执行', en: 'CODE ENFORCED' },
      recommended: { zh: '推荐值', en: 'Recommended' },
    }
    return translations[key]?.[language] || key
  }

  // Default config if not provided
  const discipline: TradingDisciplineConfig = config || {
    enable_min_holding_time: false,
    min_holding_minutes: 30,
    enable_entry_indicators: false,
    max_rsi_for_long: 70,
    min_rsi_for_short: 30,
    max_price_deviation_pct: 5,
    require_stop_loss: true,
    require_take_profit: true,
    enable_close_restrictions: false,
    min_loss_pct_for_early_close: -3,
    close_reasoning_min_length: 50,
    enable_close_signal_check: false,
    max_signal_score_for_close: 40,
  }

  const updateField = <K extends keyof TradingDisciplineConfig>(
    key: K,
    value: TradingDisciplineConfig[K]
  ) => {
    if (!disabled) {
      onChange({ ...discipline, [key]: value })
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with explanation */}
      <div className="p-3 rounded-lg" style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#a855f7' }} />
          <div>
            <p className="text-sm" style={{ color: '#EAECEF' }}>{t('subtitle')}</p>
            <p className="text-xs mt-1" style={{ color: '#848E9C' }}>
              {language === 'zh'
                ? '这些规则由后端代码强制执行，AI无法绕过。所有新功能默认关闭，不影响现有用户。'
                : 'These rules are enforced by backend code, AI cannot bypass. All new features are off by default.'}
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Minimum Holding Time */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#0B0E11', border: '1px solid #2B3139' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: '#a855f7' }} />
              <span className="font-medium" style={{ color: '#EAECEF' }}>{t('minHoldingTime')}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={discipline.enable_min_holding_time}
                onChange={(e) => updateField('enable_min_holding_time', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-purple-500"
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('enable')}</span>
            </label>
          </div>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('minHoldingTimeDesc')}</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={discipline.min_holding_minutes}
              onChange={(e) => updateField('min_holding_minutes', parseInt(e.target.value) || 30)}
              disabled={disabled || !discipline.enable_min_holding_time}
              min={5}
              max={120}
              className="w-24 px-3 py-2 rounded-lg"
              style={{
                background: '#1E2329',
                border: '1px solid #2B3139',
                color: '#EAECEF',
                opacity: discipline.enable_min_holding_time ? 1 : 0.5,
              }}
            />
            <span style={{ color: '#848E9C' }}>{t('minutes')}</span>
            <span className="text-xs px-2 py-1 rounded" style={{ background: '#1E2329', color: '#0ECB81' }}>
              {t('recommended')}: 30
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Entry Indicator Validation */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#0B0E11', border: '1px solid #2B3139' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: '#a855f7' }} />
              <span className="font-medium" style={{ color: '#EAECEF' }}>{t('entryIndicators')}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={discipline.enable_entry_indicators}
                onChange={(e) => updateField('enable_entry_indicators', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-purple-500"
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('enable')}</span>
            </label>
          </div>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('entryIndicatorsDesc')}</p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('maxRSIForLong')}</label>
              <input
                type="number"
                value={discipline.max_rsi_for_long}
                onChange={(e) => updateField('max_rsi_for_long', parseInt(e.target.value) || 70)}
                disabled={disabled || !discipline.enable_entry_indicators}
                min={50}
                max={85}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: discipline.enable_entry_indicators ? 1 : 0.5,
                }}
              />
              <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>RSI {'>'} 此值禁止做多</p>
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('minRSIForShort')}</label>
              <input
                type="number"
                value={discipline.min_rsi_for_short}
                onChange={(e) => updateField('min_rsi_for_short', parseInt(e.target.value) || 30)}
                disabled={disabled || !discipline.enable_entry_indicators}
                min={15}
                max={50}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: discipline.enable_entry_indicators ? 1 : 0.5,
                }}
              />
              <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>RSI {'<'} 此值禁止做空</p>
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('maxPriceDeviation')} (%)</label>
              <input
                type="number"
                value={discipline.max_price_deviation_pct}
                onChange={(e) => updateField('max_price_deviation_pct', parseFloat(e.target.value) || 5)}
                disabled={disabled || !discipline.enable_entry_indicators}
                min={1}
                max={15}
                step={0.5}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: discipline.enable_entry_indicators ? 1 : 0.5,
                }}
              />
              <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>偏离EMA超过此%禁止开仓</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Mandatory SL/TP */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#0B0E11', border: '1px solid #0ECB81' }}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5" style={{ color: '#0ECB81' }} />
            <span className="font-medium" style={{ color: '#EAECEF' }}>{t('mandatorySLTP')}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#0ECB81', color: '#000' }}>
              {t('codeEnforced')}
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('mandatorySLTPDesc')}</p>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={discipline.require_stop_loss}
                onChange={(e) => updateField('require_stop_loss', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('requireStopLoss')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={discipline.require_take_profit}
                onChange={(e) => updateField('require_take_profit', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('requireTakeProfit')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Section 4: Close Restrictions */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#0B0E11', border: '1px solid #2B3139' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" style={{ color: '#F6465D' }} />
              <span className="font-medium" style={{ color: '#EAECEF' }}>{t('closeRestrictions')}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={discipline.enable_close_restrictions}
                onChange={(e) => updateField('enable_close_restrictions', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-purple-500"
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('enable')}</span>
            </label>
          </div>
          <p className="text-xs mb-3" style={{ color: '#848E9C' }}>{t('closeRestrictionsDesc')}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('minLossForEarlyClose')} (%)</label>
              <input
                type="number"
                value={discipline.min_loss_pct_for_early_close}
                onChange={(e) => updateField('min_loss_pct_for_early_close', parseFloat(e.target.value) || -3)}
                disabled={disabled || !discipline.enable_close_restrictions}
                min={-10}
                max={0}
                step={0.5}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: discipline.enable_close_restrictions ? 1 : 0.5,
                }}
              />
              <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>负数，如-3表示亏损3%时允许提前平仓</p>
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: '#EAECEF' }}>{t('closeReasoningMinLength')}</label>
              <input
                type="number"
                value={discipline.close_reasoning_min_length}
                onChange={(e) => updateField('close_reasoning_min_length', parseInt(e.target.value) || 50)}
                disabled={disabled || !discipline.enable_close_restrictions}
                min={10}
                max={200}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: discipline.enable_close_restrictions ? 1 : 0.5,
                }}
              />
              <p className="text-[10px] mt-1" style={{ color: '#848E9C' }}>平仓理由的最少字符数</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
