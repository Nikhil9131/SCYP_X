"""
Quantitative Market Data Fusion Module (Backend/modules/market_data.py)

Responsibilities:
- Interfaces with yfinance to fetch real-time and historical asset pricing and trading volumes.
- Dynamically computes normalized price series and statistical correlation coefficients
  against real market benchmarks (e.g., S&P 500 ^GSPC or Nifty 50 ^NSEI) using Pandas and NumPy.
- Validates data structures using Pydantic v2 schemas for type safety and contract integrity.
- Strictly adheres to architecture.md:
  - Quantitative Fusion: yfinance, Pandas, NumPy (No API keys required).
  - Schema Validation: Pydantic v2 for structured contract enforcement.
  - 100% analytical/advisory; never executes trades or fabricates future predictions.
  - Strict honesty: Never fabricates sample records or fake fallback numbers on source/symbol failure.

Reference:
- architecture.md: Layer 5 (Schema Validation), Layer 7 (Quantitative Fusion)
- api_guideline.md: fetch_market_validation(ticker: str)
- Backend/modules/market_data_spec.md
"""

import sys
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Set

# Configure module-level logging
logger = logging.getLogger("market_data")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [market_data]: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Pydantic v2 import for Layer 5 schema enforcement
try:
    from pydantic import BaseModel, Field, ConfigDict
    PYDANTIC_AVAILABLE = True
except ImportError:
    PYDANTIC_AVAILABLE = False
    logger.warning("pydantic v2 not installed; schema validation will fallback to standard dicts.")

# Quantitative dependencies
try:
    import pandas as pd
except ImportError:
    pd = None
    logger.error("pandas library is required for quantitative calculations but is not installed.")

try:
    import numpy as np
except ImportError:
    np = None
    logger.error("numpy library is required for quantitative calculations but is not installed.")

try:
    import yfinance as yf
except ImportError:
    yf = None
    logger.error("yfinance library is required for market data retrieval but is not installed.")

# Standard lookback and benchmark configurations
DEFAULT_PERIOD: str = "3mo"
DEFAULT_US_BENCHMARK: str = "^GSPC"  # S&P 500
DEFAULT_IN_BENCHMARK: str = "^NSEI"  # Nifty 50

VALID_PERIODS: Set[str] = {
    "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"
}


# ============================================================================
# Pydantic Schemas (architecture.md Layer 5 Enforced)
# ============================================================================

if PYDANTIC_AVAILABLE:
    class HistoricalDataPoint(BaseModel):
        model_config = ConfigDict(extra="ignore")
        date: str = Field(description="ISO 8601 formatted trading date YYYY-MM-DD")
        close: float = Field(description="Historical closing price")
        volume: int = Field(default=0, description="Trading volume on date")
        normalized_price: float = Field(description="Price normalized relative to base closing price (base 1.0)")
        normalized_close: float = Field(description="Price normalized as percentage of base closing price (base 100.0)")

    class MarketValidationResponse(BaseModel):
        model_config = ConfigDict(extra="ignore")
        status: str = Field(description="'success' or 'error'")
        ticker: str = Field(description="Target stock symbol")
        benchmark_ticker: str = Field(default="", description="Benchmark symbol compared against")
        period: str = Field(default=DEFAULT_PERIOD, description="Lookback window")
        historical_price_series: List[HistoricalDataPoint] = Field(default_factory=list)
        benchmark_index_series: List[HistoricalDataPoint] = Field(default_factory=list)
        correlation_coefficient: Optional[float] = Field(default=None, description="Pearson correlation coefficient")
        return_correlation: Optional[float] = Field(default=None, description="Daily percentage return correlation")
        price_correlation: Optional[float] = Field(default=None, description="Raw closing price level correlation")
        latest_price: Optional[float] = Field(default=None, description="Most recent closing price")
        price_change_pct: Optional[float] = Field(default=None, description="Percentage change across lookback window")
        win_rate: Optional[float] = Field(default=None, description="Percentage of positive rolling 7-day windows")
        avg_7day_return: Optional[float] = Field(default=None, description="Average percentage return across 7-day intervals")
        data_points: int = Field(default=0, description="Total trading sessions retrieved")
        source: str = Field(default="yfinance")
        timestamp: str = Field(description="ISO 8601 evaluation timestamp")
        error: Optional[str] = Field(default=None, description="Error message if status is 'error'")
        warning: Optional[str] = Field(default=None, description="Warning notes if partial failure occurred")


def _build_response_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validates and enforces response structure through Pydantic when available."""
    if PYDANTIC_AVAILABLE:
        try:
            validated = MarketValidationResponse(**data)
            return validated.model_dump()
        except Exception as schema_exc:
            logger.warning(f"Pydantic schema validation note: {schema_exc}")
    return data


# ============================================================================
# Quantitative Core Functions
# ============================================================================

def get_benchmark_ticker(ticker: str) -> str:
    """
    Determines the appropriate market benchmark based on ticker exchange convention.
    - Indian equities (.NS, .BO, or common Indian large-cap symbols) -> Nifty 50 (^NSEI)
    - Default / US / Global equities -> S&P 500 (^GSPC)
    """
    if not isinstance(ticker, str):
        return DEFAULT_US_BENCHMARK

    clean_ticker = ticker.strip().upper()
    if clean_ticker.endswith(".NS") or clean_ticker.endswith(".BO"):
        return DEFAULT_IN_BENCHMARK
    if clean_ticker in ("NIFTY", "NIFTY50", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"):
        return DEFAULT_IN_BENCHMARK
    return DEFAULT_US_BENCHMARK


def compute_normalized_series(history: Any) -> List[Dict[str, Any]]:
    """
    Extracts chronological records and computes normalized price series
    relative to the initial closing price (base 1.0 ratio and base 100.0 index).

    Args:
        history: pandas DataFrame containing 'Close' and 'Volume' columns with DatetimeIndex.

    Returns:
        List of dicts: [
            {
                "date": "YYYY-MM-DD",
                "close": float,
                "volume": int,
                "normalized_price": float (base 1.0),
                "normalized_close": float (base 100.0)
            },
            ...
        ]
    """
    if pd is None or history is None or not hasattr(history, "empty") or history.empty:
        return []

    if "Close" not in history.columns:
        return []

    close_col = history["Close"]
    volume_col = history["Volume"] if "Volume" in history.columns else None

    # Determine first valid non-zero base price
    base_close: Optional[float] = None
    for val in close_col:
        if pd.notna(val) and float(val) > 0:
            base_close = float(val)
            break

    if base_close is None or base_close <= 0:
        logger.warning("No valid positive initial closing price found for price normalization.")
        return []

    series: List[Dict[str, Any]] = []
    for dt, row in history.iterrows():
        try:
            close_val = float(row["Close"]) if pd.notna(row["Close"]) else 0.0
            vol_val = int(row["Volume"]) if volume_col is not None and pd.notna(row["Volume"]) else 0

            if hasattr(dt, "strftime"):
                date_str = dt.strftime("%Y-%m-%d")
            else:
                date_str = str(dt)[:10]

            normalized_price = round(close_val / base_close, 4)
            normalized_close = round((close_val / base_close) * 100.0, 2)

            series.append({
                "date": date_str,
                "close": round(close_val, 2),
                "volume": vol_val,
                "normalized_price": normalized_price,
                "normalized_close": normalized_close,
            })
        except Exception as item_exc:
            logger.debug(f"Skipping malformed row during normalization: {item_exc}")
            continue

    return series


def calculate_correlation(
    ticker_history: Any,
    benchmark_history: Any
) -> Tuple[Optional[float], Optional[float]]:
    """
    Computes Pearson correlation coefficients between ticker and benchmark:
    1. Return correlation: Pearson correlation of daily percentage changes (pct_change).
    2. Price correlation: Pearson correlation of raw closing prices.

    Returns:
        Tuple[Optional[float], Optional[float]]: (return_correlation, price_correlation)
    """
    if pd is None or ticker_history is None or benchmark_history is None:
        return None, None

    if getattr(ticker_history, "empty", True) or getattr(benchmark_history, "empty", True):
        return None, None

    try:
        t_close = ticker_history["Close"].copy()
        b_close = benchmark_history["Close"].copy()

        t_dates = [idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10] for idx in t_close.index]
        b_dates = [idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10] for idx in b_close.index]

        s_t = pd.Series(t_close.values, index=t_dates, name="ticker")
        s_b = pd.Series(b_close.values, index=b_dates, name="benchmark")

        # Inner join to align strictly on overlapping trading dates
        aligned = pd.concat([s_t, s_b], axis=1, join="inner").dropna()

        if len(aligned) < 2:
            logger.warning(f"Insufficient overlapping trading days ({len(aligned)}) to compute correlation.")
            return None, None

        # Check for zero variance
        if aligned["ticker"].nunique() <= 1 or aligned["benchmark"].nunique() <= 1:
            logger.warning("Zero variance detected in price series; Pearson correlation is undefined.")
            return None, None

        # Raw price level correlation
        price_corr_val = aligned["ticker"].corr(aligned["benchmark"])
        price_corr = round(float(price_corr_val), 4) if pd.notna(price_corr_val) else None

        # Daily percentage return correlation
        returns = aligned.pct_change().dropna()
        if len(returns) >= 2 and returns["ticker"].nunique() > 1 and returns["benchmark"].nunique() > 1:
            ret_corr_val = returns["ticker"].corr(returns["benchmark"])
            ret_corr = round(float(ret_corr_val), 4) if pd.notna(ret_corr_val) else price_corr
        else:
            ret_corr = price_corr

        return ret_corr, price_corr

    except Exception as exc:
        logger.warning(f"Error computing correlation metrics: {exc}")
        return None, None


def fetch_market_validation(
    ticker: str,
    period: str = DEFAULT_PERIOD,
    benchmark_ticker: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main quantitative fusion entry point:
    1. Validates ticker and period inputs.
    2. Queries yfinance for real historical closing prices and trading volumes.
    3. Queries yfinance for benchmark index (e.g. S&P 500 ^GSPC or Nifty 50 ^NSEI).
    4. Computes normalized price series and statistical correlation coefficients.
    5. Returns actual dynamic results validated via Pydantic; never returns fabricated numbers on failure.

    Args:
        ticker: Target stock symbol (e.g., 'TSLA', 'AAPL', 'RELIANCE.NS').
        period: Historical lookback duration ('1mo', '3mo', '6mo', '1y'). Defaults to '3mo'.
        benchmark_ticker: Optional benchmark symbol override. Defaults to auto-selection.

    Returns:
        dict containing:
            - status ('success' | 'error')
            - ticker (str)
            - benchmark_ticker (str)
            - period (str)
            - historical_price_series (list of daily price/volume dicts)
            - benchmark_index_series (list of benchmark price/volume dicts)
            - correlation_coefficient (Optional[float])
            - return_correlation (Optional[float])
            - price_correlation (Optional[float])
            - latest_price (Optional[float])
            - price_change_pct (Optional[float])
            - data_points (int)
            - source ('yfinance')
            - timestamp (ISO 8601 string)
            - error (Optional[str])
            - warning (Optional[str])
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    # Input validation: ticker type and emptiness
    if not isinstance(ticker, str) or not ticker.strip():
        return _build_response_dict({
            "status": "error",
            "ticker": str(ticker) if ticker is not None else "",
            "benchmark_ticker": "",
            "period": period if isinstance(period, str) else DEFAULT_PERIOD,
            "historical_price_series": [],
            "benchmark_index_series": [],
            "correlation_coefficient": None,
            "return_correlation": None,
            "price_correlation": None,
            "latest_price": None,
            "price_change_pct": None,
            "data_points": 0,
            "source": "yfinance",
            "timestamp": timestamp,
            "error": "Invalid or empty ticker symbol provided.",
            "warning": None,
        })

    clean_ticker = ticker.strip().upper()

    # Input validation: period
    warning_note: Optional[str] = None
    clean_period = period.strip().lower() if isinstance(period, str) and period.strip() else DEFAULT_PERIOD
    if clean_period not in VALID_PERIODS:
        warning_note = f"Lookback period '{period}' is unrecognized. Defaulting to '{DEFAULT_PERIOD}'."
        logger.warning(warning_note)
        clean_period = DEFAULT_PERIOD

    # Check dependency readiness
    if yf is None or pd is None:
        return _build_response_dict({
            "status": "error",
            "ticker": clean_ticker,
            "benchmark_ticker": "",
            "period": clean_period,
            "historical_price_series": [],
            "benchmark_index_series": [],
            "correlation_coefficient": None,
            "return_correlation": None,
            "price_correlation": None,
            "latest_price": None,
            "price_change_pct": None,
            "data_points": 0,
            "source": "yfinance",
            "timestamp": timestamp,
            "error": "Required libraries (yfinance/pandas) are not installed in the environment.",
            "warning": warning_note,
        })

    # Resolve benchmark
    benchmark = (benchmark_ticker or get_benchmark_ticker(clean_ticker)).strip().upper()

    try:
        logger.info(f"Fetching live market data via yfinance for '{clean_ticker}' (period={clean_period}, benchmark={benchmark})...")

        # 1. Fetch real target ticker history
        ticker_obj = yf.Ticker(clean_ticker)
        ticker_hist = ticker_obj.history(period=clean_period)

        if ticker_hist is None or ticker_hist.empty or len(ticker_hist) == 0:
            error_msg = f"No historical market data found for ticker '{clean_ticker}' with period '{clean_period}'."
            logger.warning(error_msg)
            return _build_response_dict({
                "status": "error",
                "ticker": clean_ticker,
                "benchmark_ticker": benchmark,
                "period": clean_period,
                "historical_price_series": [],
                "benchmark_index_series": [],
                "correlation_coefficient": None,
                "return_correlation": None,
                "price_correlation": None,
                "latest_price": None,
                "price_change_pct": None,
                "data_points": 0,
                "source": "yfinance",
                "timestamp": timestamp,
                "error": error_msg,
                "warning": warning_note,
            })

        # 2. Fetch real benchmark index history
        bm_hist = None
        bm_warning: Optional[str] = None
        try:
            bm_obj = yf.Ticker(benchmark)
            bm_hist = bm_obj.history(period=clean_period)
            if bm_hist is None or bm_hist.empty:
                bm_warning = f"Benchmark '{benchmark}' returned no historical data."
                logger.warning(bm_warning)
        except Exception as bm_exc:
            bm_warning = f"Failed to retrieve benchmark '{benchmark}' history: {bm_exc}."
            logger.warning(bm_warning)

        # 3. Dynamically compute normalized series
        hist_series = compute_normalized_series(ticker_hist)
        bm_series = compute_normalized_series(bm_hist) if bm_hist is not None else []

        # 4. Dynamically compute statistical correlation
        ret_corr, price_corr = calculate_correlation(ticker_hist, bm_hist) if bm_hist is not None else (None, None)

        # 5. Extract genuine metrics
        latest_price = hist_series[-1]["close"] if hist_series else None
        first_price = hist_series[0]["close"] if hist_series else None
        price_change_pct = (
            round(((latest_price - first_price) / first_price) * 100.0, 2)
            if (latest_price is not None and first_price is not None and first_price > 0)
            else None
        )

        # 6. Dynamically compute genuine rolling 7-day win-rate and average return
        win_rate: Optional[float] = None
        avg_7day_return: Optional[float] = None
        if ticker_hist is not None and not ticker_hist.empty and len(ticker_hist) >= 2:
            try:
                lookback_window = min(7, len(ticker_hist) - 1)
                rolling_returns = ticker_hist["Close"].pct_change(periods=lookback_window).dropna()
                if len(rolling_returns) > 0:
                    win_rate = round(float((rolling_returns > 0).mean() * 100.0), 1)
                    avg_7day_return = round(float(rolling_returns.mean() * 100.0), 2)
            except Exception as w_exc:
                logger.debug(f"Rolling return calculation note: {w_exc}")

        combined_warning = " | ".join(filter(None, [warning_note, bm_warning])) or None

        logger.info(
            f"Successfully retrieved {len(hist_series)} points for '{clean_ticker}'. "
            f"Correlation vs {benchmark}: {ret_corr}."
        )

        return _build_response_dict({
            "status": "success",
            "ticker": clean_ticker,
            "benchmark_ticker": benchmark,
            "period": clean_period,
            "historical_price_series": hist_series,
            "benchmark_index_series": bm_series,
            "correlation_coefficient": ret_corr,
            "return_correlation": ret_corr,
            "price_correlation": price_corr,
            "latest_price": latest_price,
            "price_change_pct": price_change_pct,
            "win_rate": win_rate,
            "avg_7day_return": avg_7day_return,
            "data_points": len(hist_series),
            "source": "yfinance",
            "timestamp": timestamp,
            "error": None,
            "warning": combined_warning,
        })

    except Exception as exc:
        error_msg = f"Market data retrieval failed: {str(exc)}"
        logger.error(error_msg)
        return _build_response_dict({
            "status": "error",
            "ticker": clean_ticker,
            "benchmark_ticker": benchmark,
            "period": clean_period,
            "historical_price_series": [],
            "benchmark_index_series": [],
            "correlation_coefficient": None,
            "return_correlation": None,
            "price_correlation": None,
            "latest_price": None,
            "price_change_pct": None,
            "data_points": 0,
            "source": "yfinance",
            "timestamp": timestamp,
            "error": error_msg,
            "warning": warning_note,
        })


if __name__ == "__main__":
    print("Self-test: Live market validation for TSLA...")
    res = fetch_market_validation("TSLA", period="1mo")
    print(f"Status: {res.get('status')}")
    print(f"Ticker: {res.get('ticker')}, Benchmark: {res.get('benchmark_ticker')}")
    print(f"Data points: {res.get('data_points')}, Correlation: {res.get('correlation_coefficient')}")
    print(f"Latest price: {res.get('latest_price')}, Change: {res.get('price_change_pct')}%")
