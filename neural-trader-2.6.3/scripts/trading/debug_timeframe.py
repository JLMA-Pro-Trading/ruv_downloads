from src.trading.strategies.swing_trader import SwingTradingEngine

engine = SwingTradingEngine()

timeframes = {
    'daily': {
        'trend': 'bullish',
        'rsi': 70,
        'ma_alignment': 'bullish'
    },
    '4hour': {
        'trend': 'bearish',
        'rsi': 35,
        'ma_alignment': 'bearish'
    },
    '1hour': {
        'trend': 'bearish',
        'rsi': 30,
        'ma_alignment': 'bearish'
    }
}

scores = []
trend_count = {"bullish": 0, "bearish": 0, "neutral": 0}

# Weight higher timeframes more
weights = {"daily": 0.5, "4hour": 0.3, "1hour": 0.2}

for tf_name, tf_data in timeframes.items():
    weight = weights.get(tf_name, 0.33)
    
    # Score based on trend alignment
    if tf_data["trend"] == "bullish":
        score = 1.0
        trend_count["bullish"] += 1
    elif tf_data["trend"] == "bearish":
        score = 0.0
        trend_count["bearish"] += 1
    else:
        score = 0.5
        trend_count["neutral"] += 1
    
    print(f"{tf_name}: Initial score = {score}")
    
    # MA alignment bonus/penalty - apply early
    if tf_data["ma_alignment"] == "bullish":
        score *= 1.1
        print(f"{tf_name}: After bullish MA = {score}")
    elif tf_data["ma_alignment"] == "bearish":
        score *= 0.05  # Very strong penalty for bearish alignment
        print(f"{tf_name}: After bearish MA = {score}")
    else:  # mixed alignment
        score *= 0.5
        print(f"{tf_name}: After mixed MA = {score}")
        
    # Adjust for RSI - more aggressive penalties applied after MA adjustments
    if tf_data["rsi"] > 70:
        score = 0.01  # Essentially zero out overbought signals
        print(f"{tf_name}: After overbought RSI = {score}")
    elif tf_data["rsi"] < 30:
        if tf_data["trend"] == "bearish":
            score *= 0.1  # Very low score for oversold in bearish trend
            print(f"{tf_name}: After oversold in bearish = {score}")
        else:
            score *= 0.7
            print(f"{tf_name}: After oversold in non-bearish = {score}")
    
    final_score = score * weight
    print(f"{tf_name}: Final weighted score = {final_score}")
    scores.append(final_score)
    print()

total_score = sum(scores)
print(f"Total score: {total_score}")
print(f"Individual scores: {scores}")