export interface SystemStatus {
  trader_id: string
  trader_name: string
  ai_model: string
  is_running: boolean
  start_time: string
  runtime_minutes: number
  call_count: number
  initial_balance: number
  scan_interval: string
  stop_until: string
  last_reset_time: string
  ai_provider: string
  strategy_type?: 'ai_trading' | 'grid_trading'
  grid_symbol?: string
}

export interface AccountInfo {
  total_equity: number
  wallet_balance: number
  unrealized_profit: number // 未实现盈亏（交易所API官方值）
  available_balance: number
  total_pnl: number
  total_pnl_pct: number
  initial_balance: number
  daily_pnl: number
  position_count: number
  margin_used: number
  margin_used_pct: number
}

// Trailing stop state for position display
export interface TrailingStopState {
  active: boolean
  initial_stop: number
  current_stop: number
  peak_price: number
  peak_pnl_pct: number // deprecated, kept for compatibility
  peak_profit: number // 峰值盈利（USDT）
  margin: number // 保证金
  leverage: number // 杠杆
  update_count: number
  last_updated: string
}

export interface Position {
  symbol: string
  side: string
  entry_price: number
  mark_price: number
  quantity: number
  leverage: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  liquidation_price: number
  margin_used: number
  trailing_stop?: TrailingStopState
}

export interface DecisionAction {
  action: string
  symbol: string
  quantity: number
  leverage: number
  price: number
  stop_loss?: number      // Stop loss price
  take_profit?: number    // Take profit price
  confidence?: number     // AI confidence (0-100)
  reasoning?: string      // Brief reasoning
  order_id: number
  timestamp: string
  success: boolean
  error?: string
  validation_result?: DecisionValidationResult  // Validation result from backend
}

// Signal score breakdown
export interface SignalScore {
  total: number           // Total score (0-100)
  rsi_score: number       // RSI score (0-25)
  ema_score: number       // EMA trend score (0-25)
  volume_price_score: number  // Volume-price alignment score (0-20)
  multi_tf_score: number  // Multi-timeframe resonance score (0-30)
  details?: string        // Score details
  // Detailed sub-scores
  rsi_sub_score?: RSISubScore
  ema_sub_score?: EMASubScore
  volume_sub_score?: VolumeSubScore
  multi_tf_sub_score?: MultiTFSubScore
}

// RSI sub-score details
export interface RSISubScore {
  position_score: number   // RSI position score (0-15)
  trend_score: number      // RSI trend score (0-5)
  diverge_score: number    // RSI divergence score (0-5)
  rsi_value: number        // Current RSI value
  rsi_trend: string        // RSI trend: "up", "down", "sideways"
  has_divergence: boolean  // Has divergence
}

// EMA sub-score details
export interface EMASubScore {
  price_pos_score: number  // Price position score (0-8)
  alignment_score: number  // EMA alignment score (0-9)
  slope_score: number      // EMA slope score (0-8)
  price_vs_ema20: number   // Price vs EMA20 deviation %
  ema_alignment: string    // EMA alignment state
  ema_slope: string        // EMA slope direction
}

// Volume sub-score details
export interface VolumeSubScore {
  oi_price_score: number   // OI+price score (0-10)
  volume_score: number     // Volume score (0-5)
  diverge_score: number    // Volume divergence score (0-5)
  oi_change: number        // OI change %
  volume_ratio: number     // Volume ratio
  has_divergence: boolean  // Has volume divergence
}

// Multi-timeframe sub-score details
export interface MultiTFSubScore {
  short_tf_score: number           // Short timeframe score (0-8)
  mid_tf_score: number             // Mid timeframe score (0-10)
  long_tf_score: number            // Long timeframe score (0-12)
  tf_trends: Record<string, string> // Timeframe trends
  tf_alignment: string             // Overall alignment state
}

// Trend analysis result
export interface TrendAnalysis {
  direction: string       // Trend direction: 'up', 'down', 'sideways'
  strength: number        // Trend strength (0-100)
  primary_tf?: string     // Primary timeframe
  confirm_tf?: string     // Confirmation timeframe
  is_confirmed?: boolean  // Multi-timeframe confirmed
  ema_alignment?: string  // EMA alignment state
  price_position?: string // Price position relative to EMA
  details?: string        // Detailed explanation
}

// Decision validation result from backend
export interface DecisionValidationResult {
  passed: boolean
  signal_score?: SignalScore
  trend_analysis?: TrendAnalysis
  validation_error?: string
}

export interface AccountSnapshot {
  total_balance: number
  available_balance: number
  total_unrealized_profit: number
  position_count: number
  margin_used_pct: number
}

export interface DecisionRecord {
  timestamp: string
  cycle_number: number
  system_prompt: string
  input_prompt: string
  cot_trace: string
  decision_json: string
  account_state: AccountSnapshot
  positions: any[]
  candidate_coins: string[]
  decisions: DecisionAction[]
  execution_log: string[]
  success: boolean
  error_message?: string
}

export interface Statistics {
  total_cycles: number
  successful_cycles: number
  failed_cycles: number
  total_open_positions: number
  total_close_positions: number
}

// AI Trading相关类型
export interface TraderInfo {
  trader_id: string
  trader_name: string
  ai_model: string
  exchange_id?: string
  is_running?: boolean
  show_in_competition?: boolean
  strategy_id?: string
  strategy_name?: string
  custom_prompt?: string
  use_ai500?: boolean
  use_oi_top?: boolean
  system_prompt_template?: string
}

export interface AIModel {
  id: string
  name: string
  provider: string
  enabled: boolean
  apiKey?: string
  customApiUrl?: string
  customModelName?: string
}

export interface Exchange {
  id: string                     // UUID (empty for supported exchange templates)
  exchange_type: string          // "binance", "bybit", "okx", "hyperliquid", "aster", "lighter"
  account_name: string           // User-defined account name
  name: string                   // Display name
  type: 'cex' | 'dex'
  enabled: boolean
  apiKey?: string
  secretKey?: string
  passphrase?: string            // OKX specific
  testnet?: boolean
  // Hyperliquid specific
  hyperliquidWalletAddr?: string
  // Aster specific
  asterUser?: string
  asterSigner?: string
  asterPrivateKey?: string
  // LIGHTER specific
  lighterWalletAddr?: string
  lighterPrivateKey?: string
  lighterApiKeyPrivateKey?: string
  lighterApiKeyIndex?: number
}

export interface CreateExchangeRequest {
  exchange_type: string          // "binance", "bybit", "okx", "hyperliquid", "aster", "lighter"
  account_name: string           // User-defined account name
  enabled: boolean
  api_key?: string
  secret_key?: string
  passphrase?: string
  testnet?: boolean
  hyperliquid_wallet_addr?: string
  aster_user?: string
  aster_signer?: string
  aster_private_key?: string
  lighter_wallet_addr?: string
  lighter_private_key?: string
  lighter_api_key_private_key?: string
  lighter_api_key_index?: number
}

export interface CreateTraderRequest {
  name: string
  ai_model_id: string
  exchange_id: string
  strategy_id?: string // 策略ID（新版，使用保存的策略配置）
  initial_balance?: number // 可选：创建时由后端自动获取，编辑时可手动更新
  scan_interval_minutes?: number
  is_cross_margin?: boolean
  show_in_competition?: boolean // 是否在竞技场显示
  // 以下字段为向后兼容保留，新版使用策略配置
  btc_eth_leverage?: number
  altcoin_leverage?: number
  trading_symbols?: string
  custom_prompt?: string
  override_base_prompt?: boolean
  system_prompt_template?: string
  use_ai500?: boolean
  use_oi_top?: boolean
}

export interface UpdateModelConfigRequest {
  models: {
    [key: string]: {
      enabled: boolean
      api_key: string
      custom_api_url?: string
      custom_model_name?: string
    }
  }
}

export interface UpdateExchangeConfigRequest {
  exchanges: {
    [key: string]: {
      enabled: boolean
      api_key: string
      secret_key: string
      passphrase?: string
      testnet?: boolean
      // Hyperliquid 特定字段
      hyperliquid_wallet_addr?: string
      // Aster 特定字段
      aster_user?: string
      aster_signer?: string
      aster_private_key?: string
      // LIGHTER 特定字段
      lighter_wallet_addr?: string
      lighter_private_key?: string
      lighter_api_key_private_key?: string
      lighter_api_key_index?: number
    }
  }
}

// Competition related types
export interface CompetitionTraderData {
  trader_id: string
  trader_name: string
  ai_model: string
  exchange: string
  total_equity: number
  total_pnl: number
  total_pnl_pct: number
  position_count: number
  margin_used_pct: number
  is_running: boolean
}

export interface CompetitionData {
  traders: CompetitionTraderData[]
  count: number
}

// Trader Configuration Data for View Modal
export interface TraderConfigData {
  trader_id?: string
  trader_name: string
  ai_model: string
  exchange_id: string
  strategy_id?: string  // 策略ID
  strategy_name?: string  // 策略名称
  is_cross_margin: boolean
  show_in_competition: boolean  // 是否在竞技场显示
  scan_interval_minutes: number
  initial_balance: number
  is_running: boolean
  // 以下为旧版字段（向后兼容）
  btc_eth_leverage?: number
  altcoin_leverage?: number
  trading_symbols?: string
  custom_prompt?: string
  override_base_prompt?: boolean
  system_prompt_template?: string
  use_ai500?: boolean
  use_oi_top?: boolean
}

// Backtest types
export interface BacktestRunSummary {
  symbol_count: number;
  decision_tf: string;
  processed_bars: number;
  progress_pct: number;
  equity_last: number;
  max_drawdown_pct: number;
  liquidated: boolean;
  liquidation_note?: string;
}

export interface BacktestRunMetadata {
  run_id: string;
  label?: string;
  user_id?: string;
  last_error?: string;
  version: number;
  state: string;
  created_at: string;
  updated_at: string;
  summary: BacktestRunSummary;
}

export interface BacktestRunsResponse {
  total: number;
  items: BacktestRunMetadata[];
}

// Position status for real-time display during backtest
export interface BacktestPositionStatus {
  symbol: string;
  side: string;
  quantity: number;
  entry_price: number;
  mark_price: number;
  leverage: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  margin_used: number;
}

export interface BacktestStatusPayload {
  run_id: string;
  state: string;
  progress_pct: number;
  processed_bars: number;
  current_time: number;
  decision_cycle: number;
  equity: number;
  unrealized_pnl: number;
  realized_pnl: number;
  positions?: BacktestPositionStatus[];
  note?: string;
  last_error?: string;
  last_updated_iso: string;
}

export interface BacktestEquityPoint {
  ts: number;
  equity: number;
  available: number;
  pnl: number;
  pnl_pct: number;
  dd_pct: number;
  cycle: number;
}

export interface BacktestTradeEvent {
  ts: number;
  symbol: string;
  action: string;
  side?: string;
  qty: number;
  price: number;
  fee: number;
  slippage: number;
  order_value: number;
  realized_pnl: number;
  leverage?: number;
  cycle: number;
  position_after: number;
  liquidation: boolean;
  note?: string;
}

export interface BacktestMetrics {
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  profit_factor: number;
  win_rate: number;
  trades: number;
  avg_win: number;
  avg_loss: number;
  best_symbol: string;
  worst_symbol: string;
  liquidated: boolean;
  symbol_stats?: Record<
    string,
    {
      total_trades: number;
      winning_trades: number;
      losing_trades: number;
      total_pnl: number;
      avg_pnl: number;
      win_rate: number;
    }
  >;
}

export interface BacktestStartConfig {
  run_id?: string;
  ai_model_id?: string;
  strategy_id?: string; // Optional: use saved strategy from Strategy Studio
  symbols: string[];
  timeframes: string[];
  decision_timeframe: string;
  decision_cadence_nbars: number;
  start_ts: number;
  end_ts: number;
  initial_balance: number;
  fee_bps: number;
  slippage_bps: number;
  fill_policy: string;
  prompt_variant?: string;
  prompt_template?: string;
  custom_prompt?: string;
  override_prompt?: boolean;
  cache_ai?: boolean;
  replay_only?: boolean;
  checkpoint_interval_bars?: number;
  checkpoint_interval_seconds?: number;
  replay_decision_dir?: string;
  shared_ai_cache_path?: string;
  ai?: {
    provider?: string;
    model?: string;
    key?: string;
    secret_key?: string;
    base_url?: string;
  };
  leverage?: {
    btc_eth_leverage?: number;
    altcoin_leverage?: number;
  };
}

// Kline data for backtest chart
export interface BacktestKline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestKlinesResponse {
  symbol: string;
  timeframe: string;
  start_ts: number;
  end_ts: number;
  count: number;
  klines: BacktestKline[];
  run_id: string;
}

// Strategy Studio Types
export interface Strategy {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
  is_public: boolean;           // 是否在策略市场公开
  config_visible: boolean;      // 配置参数是否公开可见
  config: StrategyConfig;
  created_at: string;
  updated_at: string;
}

// 策略使用统计
export interface StrategyStats {
  clone_count: number;          // 被克隆次数
  active_users: number;         // 当前使用人数
  top_performers?: StrategyPerformer[];  // 收益排行
}

// 策略使用者收益排行
export interface StrategyPerformer {
  user_id: string;
  user_name: string;            // 脱敏后的用户名
  total_pnl_pct: number;        // 总收益率
  total_pnl: number;            // 总收益金额
  win_rate: number;             // 胜率
  trade_count: number;          // 交易次数
  using_since: string;          // 使用开始时间
  rank: number;                 // 排名
}

export interface PromptSectionsConfig {
  role_definition?: string;
  trading_frequency?: string;
  entry_standards?: string;
  decision_process?: string;
}

export interface StrategyConfig {
  // Strategy type: "ai_trading" (default) or "grid_trading"
  strategy_type?: 'ai_trading' | 'grid_trading';
  // Language setting: "zh" for Chinese, "en" for English
  // Determines the language used for data formatting and prompt generation
  language?: 'zh' | 'en';
  coin_source: CoinSourceConfig;
  indicators: IndicatorConfig;
  custom_prompt?: string;
  risk_control: RiskControlConfig;
  prompt_sections?: PromptSectionsConfig;
  // Grid trading configuration (only used when strategy_type is 'grid_trading')
  grid_config?: GridStrategyConfig;
}

// Grid trading specific configuration
export interface GridStrategyConfig {
  // Trading pair (e.g., "BTCUSDT")
  symbol: string;
  // Number of grid levels (5-50)
  grid_count: number;
  // Total investment in USDT
  total_investment: number;
  // Leverage (1-20)
  leverage: number;
  // Upper price boundary (0 = auto-calculate from ATR)
  upper_price: number;
  // Lower price boundary (0 = auto-calculate from ATR)
  lower_price: number;
  // Use ATR to auto-calculate bounds
  use_atr_bounds: boolean;
  // ATR multiplier for bound calculation (default 2.0)
  atr_multiplier: number;
  // Position distribution: "uniform" | "gaussian" | "pyramid"
  distribution: 'uniform' | 'gaussian' | 'pyramid';
  // Maximum drawdown percentage before emergency exit
  max_drawdown_pct: number;
  // Stop loss percentage per position
  stop_loss_pct: number;
  // Daily loss limit percentage
  daily_loss_limit_pct: number;
  // Use maker-only orders for lower fees
  use_maker_only: boolean;
  // Enable automatic grid direction adjustment based on box breakouts
  enable_direction_adjust?: boolean;
  // Direction bias ratio for long_bias/short_bias modes (default 0.7 = 70%/30%)
  direction_bias_ratio?: number;
}

export interface CoinSourceConfig {
  source_type: 'static' | 'ai500' | 'oi_top' | 'oi_low' | 'mixed';
  static_coins?: string[];
  excluded_coins?: string[];   // 排除的币种列表
  use_ai500: boolean;
  ai500_limit?: number;
  use_oi_top: boolean;
  oi_top_limit?: number;
  use_oi_low: boolean;
  oi_low_limit?: number;
  // Note: API URLs are now built automatically using nofxos_api_key from IndicatorConfig
}

export interface IndicatorConfig {
  klines: KlineConfig;
  // Raw OHLCV kline data - required for AI analysis
  enable_raw_klines: boolean;
  // Technical indicators (optional)
  enable_ema: boolean;
  enable_macd: boolean;
  enable_rsi: boolean;
  enable_atr: boolean;
  enable_boll: boolean;
  enable_volume: boolean;
  enable_oi: boolean;
  enable_funding_rate: boolean;
  ema_periods?: number[];
  rsi_periods?: number[];
  atr_periods?: number[];
  boll_periods?: number[];
  external_data_sources?: ExternalDataSource[];

  // ========== NofxOS 数据源统一配置 ==========
  // Unified NofxOS API Key - used for all NofxOS data sources
  nofxos_api_key?: string;

  // 量化数据源（资金流向、持仓变化、价格变化）
  enable_quant_data?: boolean;
  enable_quant_oi?: boolean;
  enable_quant_netflow?: boolean;

  // OI 排行数据（市场持仓量增减排行）
  enable_oi_ranking?: boolean;
  oi_ranking_duration?: string;  // "1h", "4h", "24h"
  oi_ranking_limit?: number;

  // NetFlow 排行数据（机构/散户资金流向排行）
  enable_netflow_ranking?: boolean;
  netflow_ranking_duration?: string;  // "1h", "4h", "24h"
  netflow_ranking_limit?: number;

  // Price 排行数据（涨跌幅排行）
  enable_price_ranking?: boolean;
  price_ranking_duration?: string;  // "1h", "4h", "24h" or "1h,4h,24h"
  price_ranking_limit?: number;
}

export interface KlineConfig {
  primary_timeframe: string;
  primary_count: number;
  longer_timeframe?: string;
  longer_count?: number;
  enable_multi_timeframe: boolean;
  // 新增：支持选择多个时间周期
  selected_timeframes?: string[];
}

export interface ExternalDataSource {
  name: string;
  type: 'api' | 'webhook';
  url: string;
  method: string;
  headers?: Record<string, string>;
  data_path?: string;
  refresh_secs?: number;
}

// Trading Discipline Configuration (CODE ENFORCED)
export interface TradingDisciplineConfig {
  // === Minimum Holding Time ===
  enable_min_holding_time: boolean;    // Enable minimum holding time check
  min_holding_minutes: number;         // Minimum holding time in minutes (default: 30)

  // === Entry Indicator Validation (Prevent Chasing) ===
  enable_entry_indicators: boolean;    // Enable indicator-based entry validation
  max_rsi_for_long: number;            // Max RSI for long entry - prevent buying at overbought (default: 70)
  min_rsi_for_short: number;           // Min RSI for short entry - prevent selling at oversold (default: 30)
  max_price_deviation_pct: number;     // Max price deviation from EMA20 in percent (default: 5%)

  // === Mandatory Stop-Loss/Take-Profit ===
  require_stop_loss: boolean;          // Require stop-loss for all positions
  require_take_profit: boolean;        // Require take-profit for all positions

  // === Close Position Restrictions ===
  enable_close_restrictions: boolean;  // Enable close position restrictions
  min_loss_pct_for_early_close: number; // Min loss % to allow early close (negative, e.g., -3.0)
  close_reasoning_min_length: number;  // Min characters for close reasoning

  // === Close Signal Check ===
  enable_close_signal_check: boolean;  // Enable signal check before closing
  max_signal_score_for_close: number;  // Max signal score to allow close (0-100, default: 40)
}

// Conservative Strategy Configuration (CODE ENFORCED)
// Focus on fewer but higher quality trades, following trends
export interface ConservativeStrategyConfig {
  // === Daily Limits ===
  enable_daily_limits: boolean;        // Enable daily trading limits
  max_daily_trades: number;            // Maximum number of trades per day (default: 3)
  max_daily_loss_pct: number;          // Maximum daily loss percentage (negative, e.g., -5.0)

  // === Signal Quality Scoring ===
  enable_signal_scoring: boolean;      // Enable signal quality scoring
  min_signal_score: number;            // Minimum signal score to accept trade (0-100, default: 60)

  // === Trend Confirmation ===
  enable_trend_confirm: boolean;       // Enable trend confirmation
  require_multi_timeframe: boolean;    // Require multi-timeframe trend confirmation (15M + 1H must align)

  // === Trailing Stop (Drawdown Mode) ===
  enable_trailing_stop: boolean;       // Enable trailing stop-loss
  trail_trigger_pct: number;           // Profit percentage to trigger trailing (default: 5%)
  trail_drawdown_pct: number;          // Drawdown percentage to trigger stop (default: 3%)
}

export interface RiskControlConfig {
  // Max number of coins held simultaneously (CODE ENFORCED)
  max_positions: number;

  // Trading Leverage - exchange leverage for opening positions (AI guided)
  btc_eth_max_leverage: number;    // BTC/ETH max exchange leverage
  altcoin_max_leverage: number;    // Altcoin max exchange leverage

  // Position Value Ratio - single position notional value / account equity (CODE ENFORCED)
  // Max position value = equity × this ratio
  btc_eth_max_position_value_ratio?: number;     // default: 5 (BTC/ETH max position = 5x equity)
  altcoin_max_position_value_ratio?: number;     // default: 1 (Altcoin max position = 1x equity)

  // Risk Parameters
  max_margin_usage: number;        // Max margin utilization, e.g. 0.9 = 90% (CODE ENFORCED)
  min_position_size: number;       // Min position size in USDT (CODE ENFORCED)
  min_risk_reward_ratio: number;   // Min take_profit / stop_loss ratio (AI guided)
  min_confidence: number;          // Min AI confidence to open position (AI guided)

  // Trading Discipline Configuration (CODE ENFORCED)
  trading_discipline?: TradingDisciplineConfig;

  // Conservative Strategy Configuration (CODE ENFORCED)
  conservative_strategy?: ConservativeStrategyConfig;
}

// Debate Arena Types
export type DebateStatus = 'pending' | 'running' | 'voting' | 'completed' | 'cancelled';
export type DebatePersonality = 'bull' | 'bear' | 'analyst' | 'contrarian' | 'risk_manager';

export interface DebateDecision {
  action: string;
  symbol: string;
  confidence: number;
  leverage?: number;
  position_pct?: number;
  position_size_usd?: number;
  stop_loss?: number;
  take_profit?: number;
  reasoning: string;
  // Execution tracking
  executed?: boolean;
  executed_at?: string;
  order_id?: string;
  error?: string;
}

export interface DebateSession {
  id: string;
  user_id: string;
  name: string;
  strategy_id: string;
  status: DebateStatus;
  symbol: string;
  interval_minutes: number;
  prompt_variant: string;
  trader_id?: string;
  max_rounds: number;
  current_round: number;
  final_decision?: DebateDecision;
  final_decisions?: DebateDecision[];  // Multi-coin decisions
  auto_execute: boolean;
  created_at: string;
  updated_at: string;
}

export interface DebateParticipant {
  id: string;
  session_id: string;
  ai_model_id: string;
  ai_model_name: string;
  provider: string;
  personality: DebatePersonality;
  color: string;
  speak_order: number;
  created_at: string;
}

export interface DebateMessage {
  id: string;
  session_id: string;
  round: number;
  ai_model_id: string;
  ai_model_name: string;
  provider: string;
  personality: DebatePersonality;
  message_type: string;
  content: string;
  decision?: DebateDecision;
  decisions?: DebateDecision[];  // Multi-coin decisions
  confidence: number;
  created_at: string;
}

export interface DebateVote {
  id: string;
  session_id: string;
  ai_model_id: string;
  ai_model_name: string;
  action: string;
  symbol: string;
  confidence: number;
  leverage?: number;
  position_pct?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  reasoning: string;
  created_at: string;
}

export interface DebateSessionWithDetails extends DebateSession {
  participants: DebateParticipant[];
  messages: DebateMessage[];
  votes: DebateVote[];
}

export interface CreateDebateRequest {
  name: string;
  strategy_id: string;
  symbol: string;
  max_rounds?: number;
  interval_minutes?: number;  // 5, 15, 30, 60 minutes
  prompt_variant?: string;    // balanced, aggressive, conservative, scalping
  auto_execute?: boolean;
  trader_id?: string;         // Trader to use for auto-execute
  // OI Ranking data options
  enable_oi_ranking?: boolean;  // Whether to include OI ranking data
  oi_ranking_limit?: number;    // Number of OI ranking entries (default 10)
  oi_duration?: string;         // Duration for OI data (1h, 4h, 24h, etc.)
  participants: {
    ai_model_id: string;
    personality: DebatePersonality;
  }[];
}

export interface DebatePersonalityInfo {
  id: DebatePersonality;
  name: string;
  emoji: string;
  color: string;
  description: string;
}

// Position History Types
export interface HistoricalPosition {
  id: number;
  trader_id: string;
  exchange_id: string;
  exchange_type: string;
  symbol: string;
  side: string;
  quantity: number;
  entry_quantity: number;
  entry_price: number;
  entry_order_id: string;
  entry_time: string;
  exit_price: number;
  exit_order_id: string;
  exit_time: string;
  realized_pnl: number;
  fee: number;
  leverage: number;
  status: string;
  close_reason: string;
  created_at: string;
  updated_at: string;
}

// Matches Go TraderStats struct exactly
export interface TraderStats {
  total_trades: number;
  win_trades: number;
  loss_trades: number;
  win_rate: number;
  profit_factor: number;
  sharpe_ratio: number;
  total_pnl: number;
  total_fee: number;
  avg_win: number;
  avg_loss: number;
  max_drawdown_pct: number;
}

// Matches Go SymbolStats struct exactly
export interface SymbolStats {
  symbol: string;
  total_trades: number;
  win_trades: number;
  win_rate: number;
  total_pnl: number;
  avg_pnl: number;
  avg_hold_mins: number;
}

// Matches Go DirectionStats struct exactly
export interface DirectionStats {
  side: string;
  trade_count: number;
  win_rate: number;
  total_pnl: number;
  avg_pnl: number;
}

export interface PositionHistoryResponse {
  positions: HistoricalPosition[];
  stats: TraderStats | null;
  symbol_stats: SymbolStats[];
  direction_stats: DirectionStats[];
}

// Grid Risk Information for frontend display
export interface GridRiskInfo {
  // Leverage info
  current_leverage: number
  effective_leverage: number
  recommended_leverage: number

  // Position info
  current_position: number
  max_position: number
  position_percent: number

  // Liquidation info
  liquidation_price: number
  liquidation_distance: number

  // Market state
  regime_level: string

  // Box state
  short_box_upper: number
  short_box_lower: number
  mid_box_upper: number
  mid_box_lower: number
  long_box_upper: number
  long_box_lower: number
  current_price: number

  // Breakout state
  breakout_level: string
  breakout_direction: string
}

// Indicator preset types
export interface IndicatorPreset {
  id: string
  name: { zh: string; en: string }
  description: { zh: string; en: string }
  icon: string
  color: string
  primary_timeframe: string
  recommended_timeframes: string[]
  indicators: {
    enable_ema: boolean
    ema_periods: number[]
    enable_macd: boolean
    enable_rsi: boolean
    rsi_periods: number[]
    enable_atr: boolean
    atr_periods: number[]
    enable_boll: boolean
    boll_periods: number[]
    enable_volume: boolean
    enable_oi: boolean
    enable_funding_rate: boolean
  }
  kline_count: number
  risk_note?: { zh: string; en: string }
}

export interface IndicatorInfo {
  key: string
  name: { zh: string; en: string }
  description: { zh: string; en: string }
  recommended_ranges: string
  tips: { zh: string; en: string }
  color: string
}
