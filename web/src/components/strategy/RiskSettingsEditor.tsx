import { Shield, Zap, Target, Lock, Calendar, Filter } from 'lucide-react'
import { CollapsibleSection } from './CollapsibleSection'
import type { RiskControlConfig, TradingDisciplineConfig, ConservativeStrategyConfig } from '../../types'

// Default values for trading discipline config
const defaultTradingDiscipline: TradingDisciplineConfig = {
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
}

// Default values for conservative strategy config
const defaultConservativeStrategy: ConservativeStrategyConfig = {
  enable_daily_limits: false,
  max_daily_trades: 3,
  max_daily_loss_pct: -5,
  enable_signal_scoring: false,
  min_signal_score: 60,
  enable_trend_confirm: false,
  require_multi_timeframe: true,
  enable_trailing_stop: false,
  trail_after_profit_pct: 2,
  trail_to_breakeven_at: 5,
}

interface RiskSettingsEditorProps {
  riskControl: RiskControlConfig
  onChange: (config: RiskControlConfig) => void
  disabled?: boolean
  language: string
}

export function RiskSettingsEditor({
  riskControl,
  onChange,
  disabled,
  language,
}: RiskSettingsEditorProps) {
  const config = riskControl
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      // Section titles
      positionControl: { zh: '仓位控制', en: 'Position Control' },
      leverageSettings: { zh: '杠杆设置', en: 'Leverage Settings' },
      entryRules: { zh: '入场规则', en: 'Entry Rules' },
      exitRules: { zh: '出场规则', en: 'Exit Rules' },
      dailyLimits: { zh: '日频限制', en: 'Daily Limits' },
      signalFiltering: { zh: '信号筛选', en: 'Signal Filtering' },

      // Position control
      maxPositions: { zh: '最大持仓数量', en: 'Max Positions' },
      maxPositionsDesc: { zh: '同时持有的最大币种数量', en: 'Maximum coins held simultaneously' },
      btcEthPositionRatio: { zh: 'BTC/ETH 仓位价值比例', en: 'BTC/ETH Position Value Ratio' },
      btcEthPositionRatioDesc: { zh: '单仓最大名义价值 = 净值 × 此值', en: 'Max position value = equity × this ratio' },
      altcoinPositionRatio: { zh: '山寨币仓位价值比例', en: 'Altcoin Position Value Ratio' },
      altcoinPositionRatioDesc: { zh: '单仓最大名义价值 = 净值 × 此值', en: 'Max position value = equity × this ratio' },
      maxMarginUsage: { zh: '最大保证金使用率', en: 'Max Margin Usage' },
      maxMarginUsageDesc: { zh: '保证金使用率上限', en: 'Maximum margin utilization' },
      minPositionSize: { zh: '最小开仓金额', en: 'Min Position Size' },
      minPositionSizeDesc: { zh: 'USDT 最小名义价值', en: 'Minimum notional value in USDT' },

      // Leverage
      btcEthLeverage: { zh: 'BTC/ETH 杠杆', en: 'BTC/ETH Leverage' },
      btcEthLeverageDesc: { zh: '交易所开仓使用的杠杆倍数', en: 'Exchange leverage for opening positions' },
      altcoinLeverage: { zh: '山寨币杠杆', en: 'Altcoin Leverage' },
      altcoinLeverageDesc: { zh: '交易所开仓使用的杠杆倍数', en: 'Exchange leverage for opening positions' },

      // Entry rules
      minRiskReward: { zh: '最小风险回报比', en: 'Min Risk/Reward Ratio' },
      minRiskRewardDesc: { zh: '开仓要求的最低盈亏比', en: 'Minimum profit ratio for opening' },
      minConfidence: { zh: '最小信心度', en: 'Min Confidence' },
      minConfidenceDesc: { zh: 'AI 开仓信心度阈值', en: 'AI confidence threshold for entry' },
      enableEntryIndicators: { zh: '启用入场指标验证', en: 'Enable Entry Indicator Validation' },
      maxRsiForLong: { zh: '做多最大RSI', en: 'Max RSI for Long' },
      maxRsiForLongDesc: { zh: '防止追高', en: 'Prevent chasing highs' },
      minRsiForShort: { zh: '做空最小RSI', en: 'Min RSI for Short' },
      minRsiForShortDesc: { zh: '防止杀跌', en: 'Prevent panic selling' },
      maxPriceDeviation: { zh: 'EMA偏离上限', en: 'Max EMA Deviation' },
      maxPriceDeviationDesc: { zh: '价格偏离EMA20的最大百分比', en: 'Max price deviation from EMA20' },

      // Exit rules
      requireStopLoss: { zh: '强制止损', en: 'Require Stop Loss' },
      requireTakeProfit: { zh: '强制止盈', en: 'Require Take Profit' },
      enableMinHoldingTime: { zh: '启用最小持仓时间', en: 'Enable Min Holding Time' },
      minHoldingMinutes: { zh: '最小持仓时间', en: 'Min Holding Minutes' },
      enableCloseRestrictions: { zh: '启用平仓限制', en: 'Enable Close Restrictions' },
      minLossForClose: { zh: '允许平仓亏损', en: 'Min Loss for Close' },
      minLossForCloseDesc: { zh: '负数，如-3表示亏损3%以上才允许平仓', en: 'Negative, e.g., -3 means close allowed at 3%+ loss' },
      closeReasoningLength: { zh: '平仓理由最小长度', en: 'Min Close Reasoning Length' },
      enableTrailingStop: { zh: '启用移动止损', en: 'Enable Trailing Stop' },
      trailAfterProfit: { zh: '触发盈利阈值', en: 'Trail After Profit' },
      trailAfterProfitDesc: { zh: '盈利超过此值开始移动止损', en: 'Start trailing when profit exceeds this' },
      trailToBreakeven: { zh: '移至成本价点', en: 'Trail to Breakeven At' },
      trailToBreakevenDesc: { zh: '盈利超过此值止损移至成本价', en: 'Move stop to breakeven at this profit' },

      // Daily limits
      enableDailyLimits: { zh: '启用日频限制', en: 'Enable Daily Limits' },
      maxDailyTrades: { zh: '每日最大交易次数', en: 'Max Daily Trades' },
      maxDailyLossPct: { zh: '每日最大亏损比例', en: 'Max Daily Loss %' },
      maxDailyLossDesc: { zh: '负数，如-5表示亏损5%时停止交易', en: 'Negative, e.g., -5 means stop at 5% loss' },

      // Signal filtering
      enableSignalScoring: { zh: '启用信号评分', en: 'Enable Signal Scoring' },
      minSignalScore: { zh: '最低信号分数', en: 'Min Signal Score' },
      minSignalScoreDesc: { zh: '0-100分，低于此分数的信号将被拒绝', en: '0-100, signals below this will be rejected' },
      enableTrendConfirm: { zh: '启用趋势确认', en: 'Enable Trend Confirmation' },
      requireMultiTimeframe: { zh: '要求多周期确认', en: 'Require Multi-Timeframe' },
      requireMultiTfDesc: { zh: '15M + 1H趋势一致时才允许交易', en: 'Only trade when 15M + 1H trends align' },

      // Units
      trades: { zh: '次', en: 'trades' },
      percent: { zh: '%', en: '%' },
      minutes: { zh: '分钟', en: 'min' },
      chars: { zh: '字符', en: 'chars' },
    }
    return translations[key]?.[language] || key
  }

  const discipline: TradingDisciplineConfig = config.trading_discipline || defaultTradingDiscipline
  const conservative: ConservativeStrategyConfig = config.conservative_strategy || defaultConservativeStrategy

  const updateField = <K extends keyof RiskControlConfig>(
    key: K,
    value: RiskControlConfig[K]
  ) => {
    if (!disabled) {
      onChange({ ...config, [key]: value })
    }
  }

  const updateDiscipline = <K extends keyof TradingDisciplineConfig>(
    key: K,
    value: TradingDisciplineConfig[K]
  ) => {
    if (!disabled) {
      onChange({
        ...config,
        trading_discipline: { ...discipline, [key]: value },
      })
    }
  }

  const updateConservative = <K extends keyof ConservativeStrategyConfig>(
    key: K,
    value: ConservativeStrategyConfig[K]
  ) => {
    if (!disabled) {
      onChange({
        ...config,
        conservative_strategy: { ...conservative, [key]: value },
      })
    }
  }

  return (
    <div className="space-y-2">
      {/* Position Control */}
      <CollapsibleSection
        title={t('positionControl')}
        icon={<Shield className="w-4 h-4" style={{ color: '#0ECB81' }} />}
        enforcementType="code"
        defaultOpen={true}
        language={language}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
              {t('maxPositions')}
            </label>
            <p className="text-xs mb-2" style={{ color: '#848E9C' }}>
              {t('maxPositionsDesc')}
            </p>
            <input
              type="number"
              value={config.max_positions ?? 3}
              onChange={(e) => updateField('max_positions', parseInt(e.target.value) || 3)}
              disabled={disabled}
              min={1}
              max={10}
              className="w-24 px-3 py-2 rounded text-sm"
              style={{
                background: '#1E2329',
                border: '1px solid #2B3139',
                color: '#EAECEF',
              }}
            />
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
              {t('minPositionSize')}
            </label>
            <p className="text-xs mb-2" style={{ color: '#848E9C' }}>
              {t('minPositionSizeDesc')}
            </p>
            <div className="flex items-center">
              <input
                type="number"
                value={config.min_position_size ?? 12}
                onChange={(e) => updateField('min_position_size', parseFloat(e.target.value) || 12)}
                disabled={disabled}
                min={10}
                max={1000}
                className="w-24 px-3 py-2 rounded text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                }}
              />
              <span className="ml-2 text-xs" style={{ color: '#848E9C' }}>USDT</span>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
              {t('maxMarginUsage')}
            </label>
            <p className="text-xs mb-2" style={{ color: '#848E9C' }}>
              {t('maxMarginUsageDesc')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                value={(config.max_margin_usage ?? 0.9) * 100}
                onChange={(e) => updateField('max_margin_usage', parseInt(e.target.value) / 100)}
                disabled={disabled}
                min={10}
                max={100}
                className="flex-1 accent-green-500"
              />
              <span className="w-12 text-center font-mono text-sm" style={{ color: '#0ECB81' }}>
                {Math.round((config.max_margin_usage ?? 0.9) * 100)}%
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
              {t('btcEthPositionRatio')}
            </label>
            <p className="text-xs mb-2" style={{ color: '#848E9C' }}>
              {t('btcEthPositionRatioDesc')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                value={config.btc_eth_max_position_value_ratio ?? 5}
                onChange={(e) =>
                  updateField('btc_eth_max_position_value_ratio', parseFloat(e.target.value))
                }
                disabled={disabled}
                min={0.5}
                max={10}
                step={0.5}
                className="flex-1 accent-green-500"
              />
              <span className="w-12 text-center font-mono text-sm" style={{ color: '#0ECB81' }}>
                {config.btc_eth_max_position_value_ratio ?? 5}x
              </span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Leverage Settings */}
      <CollapsibleSection
        title={t('leverageSettings')}
        icon={<Zap className="w-4 h-4" style={{ color: '#F0B90B' }} />}
        enforcementType="ai"
        language={language}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
              {t('btcEthLeverage')}
            </label>
            <p className="text-xs mb-2" style={{ color: '#848E9C' }}>
              {t('btcEthLeverageDesc')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                value={config.btc_eth_max_leverage ?? 5}
                onChange={(e) => updateField('btc_eth_max_leverage', parseInt(e.target.value))}
                disabled={disabled}
                min={1}
                max={20}
                className="flex-1 accent-yellow-500"
              />
              <span className="w-12 text-center font-mono text-sm" style={{ color: '#F0B90B' }}>
                {config.btc_eth_max_leverage ?? 5}x
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
              {t('altcoinLeverage')}
            </label>
            <p className="text-xs mb-2" style={{ color: '#848E9C' }}>
              {t('altcoinLeverageDesc')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                value={config.altcoin_max_leverage ?? 5}
                onChange={(e) => updateField('altcoin_max_leverage', parseInt(e.target.value))}
                disabled={disabled}
                min={1}
                max={20}
                className="flex-1 accent-yellow-500"
              />
              <span className="w-12 text-center font-mono text-sm" style={{ color: '#F0B90B' }}>
                {config.altcoin_max_leverage ?? 5}x
              </span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Entry Rules */}
      <CollapsibleSection
        title={t('entryRules')}
        icon={<Target className="w-4 h-4" style={{ color: '#a855f7' }} />}
        enforcementType="mixed"
        language={language}
      >
        <div className="space-y-4">
          {/* AI Guided section */}
          <div className="p-3 rounded" style={{ background: 'rgba(240, 185, 11, 0.1)' }}>
            <p className="text-xs mb-2" style={{ color: '#F0B90B' }}>AI GUIDED</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
                  {t('minRiskReward')}
                </label>
                <p className="text-xs mb-2" style={{ color: '#848E9C' }}>
                  {t('minRiskRewardDesc')}
                </p>
                <div className="flex items-center">
                  <span style={{ color: '#848E9C' }}>1:</span>
                  <input
                    type="number"
                    value={config.min_risk_reward_ratio ?? 3}
                    onChange={(e) =>
                      updateField('min_risk_reward_ratio', parseFloat(e.target.value) || 3)
                    }
                    disabled={disabled}
                    min={1}
                    max={10}
                    step={0.5}
                    className="w-16 px-2 py-1 rounded ml-2 text-sm"
                    style={{
                      background: '#1E2329',
                      border: '1px solid #2B3139',
                      color: '#EAECEF',
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
                  {t('minConfidence')}
                </label>
                <p className="text-xs mb-2" style={{ color: '#848E9C' }}>
                  {t('minConfidenceDesc')}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    value={config.min_confidence ?? 75}
                    onChange={(e) => updateField('min_confidence', parseInt(e.target.value))}
                    disabled={disabled}
                    min={50}
                    max={100}
                    className="flex-1 accent-yellow-500"
                  />
                  <span className="w-10 text-center font-mono text-sm" style={{ color: '#F0B90B' }}>
                    {config.min_confidence ?? 75}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Code Enforced section */}
          <div className="p-3 rounded" style={{ background: 'rgba(14, 203, 129, 0.1)' }}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={discipline.enable_entry_indicators ?? false}
                onChange={(e) => updateDiscipline('enable_entry_indicators', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>
                {t('enableEntryIndicators')}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(14, 203, 129, 0.2)', color: '#0ECB81' }}>
                CODE ENFORCED
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#848E9C' }}>
                  {t('maxRsiForLong')}
                </label>
                <input
                  type="number"
                  value={discipline.max_rsi_for_long ?? 70}
                  onChange={(e) => updateDiscipline('max_rsi_for_long', parseInt(e.target.value) || 70)}
                  disabled={disabled || !discipline.enable_entry_indicators}
                  min={50}
                  max={100}
                  className="w-16 px-2 py-1 rounded text-sm"
                  style={{
                    background: '#1E2329',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: discipline.enable_entry_indicators ? 1 : 0.5,
                  }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#848E9C' }}>
                  {t('minRsiForShort')}
                </label>
                <input
                  type="number"
                  value={discipline.min_rsi_for_short ?? 30}
                  onChange={(e) => updateDiscipline('min_rsi_for_short', parseInt(e.target.value) || 30)}
                  disabled={disabled || !discipline.enable_entry_indicators}
                  min={0}
                  max={50}
                  className="w-16 px-2 py-1 rounded text-sm"
                  style={{
                    background: '#1E2329',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: discipline.enable_entry_indicators ? 1 : 0.5,
                  }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#848E9C' }}>
                  {t('maxPriceDeviation')} (%)
                </label>
                <input
                  type="number"
                  value={discipline.max_price_deviation_pct ?? 5}
                  onChange={(e) => updateDiscipline('max_price_deviation_pct', parseFloat(e.target.value) || 5)}
                  disabled={disabled || !discipline.enable_entry_indicators}
                  min={1}
                  max={20}
                  className="w-16 px-2 py-1 rounded text-sm"
                  style={{
                    background: '#1E2329',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: discipline.enable_entry_indicators ? 1 : 0.5,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Exit Rules */}
      <CollapsibleSection
        title={t('exitRules')}
        icon={<Lock className="w-4 h-4" style={{ color: '#0ECB81' }} />}
        enforcementType="code"
        language={language}
      >
        <div className="space-y-4">
          {/* Stop Loss / Take Profit */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={discipline.require_stop_loss ?? false}
                onChange={(e) => updateDiscipline('require_stop_loss', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('requireStopLoss')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={discipline.require_take_profit ?? false}
                onChange={(e) => updateDiscipline('require_take_profit', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('requireTakeProfit')}</span>
            </label>
          </div>

          {/* Min Holding Time */}
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={discipline.enable_min_holding_time ?? false}
              onChange={(e) => updateDiscipline('enable_min_holding_time', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 accent-green-500"
            />
            <span className="text-sm" style={{ color: '#EAECEF' }}>{t('enableMinHoldingTime')}</span>
            <input
              type="number"
              value={discipline.min_holding_minutes ?? 30}
              onChange={(e) => updateDiscipline('min_holding_minutes', parseInt(e.target.value) || 30)}
              disabled={disabled || !discipline.enable_min_holding_time}
              min={5}
              max={1440}
              className="w-20 px-2 py-1 rounded text-sm"
              style={{
                background: '#1E2329',
                border: '1px solid #2B3139',
                color: '#EAECEF',
                opacity: discipline.enable_min_holding_time ? 1 : 0.5,
              }}
            />
            <span className="text-xs" style={{ color: '#848E9C' }}>{t('minutes')}</span>
          </div>

          {/* Trailing Stop */}
          <div className="p-3 rounded" style={{ background: '#1E2329' }}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={conservative.enable_trailing_stop ?? false}
                onChange={(e) => updateConservative('enable_trailing_stop', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('enableTrailingStop')}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#848E9C' }}>
                  {t('trailAfterProfit')} (%)
                </label>
                <input
                  type="number"
                  value={conservative.trail_after_profit_pct ?? 2}
                  onChange={(e) => updateConservative('trail_after_profit_pct', parseFloat(e.target.value) || 2)}
                  disabled={disabled || !conservative.enable_trailing_stop}
                  min={0.5}
                  max={20}
                  step={0.5}
                  className="w-20 px-2 py-1 rounded text-sm"
                  style={{
                    background: '#0B0E11',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: conservative.enable_trailing_stop ? 1 : 0.5,
                  }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#848E9C' }}>
                  {t('trailToBreakeven')} (%)
                </label>
                <input
                  type="number"
                  value={conservative.trail_to_breakeven_at ?? 5}
                  onChange={(e) => updateConservative('trail_to_breakeven_at', parseFloat(e.target.value) || 5)}
                  disabled={disabled || !conservative.enable_trailing_stop}
                  min={1}
                  max={50}
                  step={0.5}
                  className="w-20 px-2 py-1 rounded text-sm"
                  style={{
                    background: '#0B0E11',
                    border: '1px solid #2B3139',
                    color: '#EAECEF',
                    opacity: conservative.enable_trailing_stop ? 1 : 0.5,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Daily Limits */}
      <CollapsibleSection
        title={t('dailyLimits')}
        icon={<Calendar className="w-4 h-4" style={{ color: '#0ECB81' }} />}
        enforcementType="code"
        language={language}
      >
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={conservative.enable_daily_limits ?? false}
            onChange={(e) => updateConservative('enable_daily_limits', e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 accent-green-500"
          />
          <span className="text-sm" style={{ color: '#EAECEF' }}>{t('enableDailyLimits')}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
              {t('maxDailyTrades')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={conservative.max_daily_trades ?? 3}
                onChange={(e) => updateConservative('max_daily_trades', parseInt(e.target.value) || 3)}
                disabled={disabled || !conservative.enable_daily_limits}
                min={1}
                max={20}
                className="w-20 px-2 py-1 rounded text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: conservative.enable_daily_limits ? 1 : 0.5,
                }}
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('trades')}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: '#EAECEF' }}>
              {t('maxDailyLossPct')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={conservative.max_daily_loss_pct ?? -5}
                onChange={(e) => updateConservative('max_daily_loss_pct', parseFloat(e.target.value) || -5)}
                disabled={disabled || !conservative.enable_daily_limits}
                min={-20}
                max={0}
                step={0.5}
                className="w-20 px-2 py-1 rounded text-sm"
                style={{
                  background: '#1E2329',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: conservative.enable_daily_limits ? 1 : 0.5,
                }}
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>{t('percent')}</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Signal Filtering */}
      <CollapsibleSection
        title={t('signalFiltering')}
        icon={<Filter className="w-4 h-4" style={{ color: '#0ECB81' }} />}
        enforcementType="code"
        language={language}
      >
        <div className="space-y-3">
          {/* Signal Scoring */}
          <div className="p-3 rounded" style={{ background: '#1E2329' }}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={conservative.enable_signal_scoring ?? false}
                onChange={(e) => updateConservative('enable_signal_scoring', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('enableSignalScoring')}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: '#848E9C' }}>{t('minSignalScore')}:</label>
              <input
                type="number"
                value={conservative.min_signal_score ?? 60}
                onChange={(e) => updateConservative('min_signal_score', parseInt(e.target.value) || 60)}
                disabled={disabled || !conservative.enable_signal_scoring}
                min={0}
                max={100}
                className="w-16 px-2 py-1 rounded text-sm"
                style={{
                  background: '#0B0E11',
                  border: '1px solid #2B3139',
                  color: '#EAECEF',
                  opacity: conservative.enable_signal_scoring ? 1 : 0.5,
                }}
              />
              <span className="text-xs" style={{ color: '#848E9C' }}>/100</span>
            </div>
          </div>

          {/* Trend Confirmation */}
          <div className="p-3 rounded" style={{ background: '#1E2329' }}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={conservative.enable_trend_confirm ?? false}
                onChange={(e) => updateConservative('enable_trend_confirm', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('enableTrendConfirm')}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={conservative.require_multi_timeframe ?? true}
                onChange={(e) => updateConservative('require_multi_timeframe', e.target.checked)}
                disabled={disabled || !conservative.enable_trend_confirm}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm" style={{ color: '#EAECEF' }}>{t('requireMultiTimeframe')}</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
