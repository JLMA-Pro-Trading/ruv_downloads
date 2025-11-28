/**
 * Adaptive Trading with Conformal Prediction Example
 *
 * This example demonstrates how to use adaptive conformal prediction for
 * real-time trading with dynamic coverage adjustment.
 */

import {
    AdaptiveConformalPredictor,
    AbsoluteScore,
    TradingDecisionEngine,
} from '../src/index';

interface Trade {
    id: number;
    signal: 'BUY' | 'SELL' | 'HOLD';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    positionSize: number;
    exitPrice: number;
    pnl: number;
}

async function tradingExample() {
    console.log('=== Adaptive Trading with Conformal Prediction ===\n');

    // Create an adaptive predictor that maintains 90% coverage
    // using PID control with learning rate gamma = 0.02
    const predictor = new AdaptiveConformalPredictor({
        targetCoverage: 0.90,
        gamma: 0.02,
        scoreFunction: new AbsoluteScore(),
    });

    // Simulate market predictions (from ML model) and actual prices
    const marketPredictions = [
        100.0, 101.2, 99.8, 102.1, 100.9, 101.5, 100.2, 102.8, 99.5, 101.0, 100.8, 101.3, 99.9, 102.5,
        100.6, 101.1, 100.3, 102.0, 99.8, 101.2,
    ];

    const marketActuals = [
        100.2, 101.5, 99.5, 102.3, 100.8, 101.8, 100.0, 103.0, 99.3, 101.2, 100.6, 101.5, 99.8, 102.7,
        100.5, 101.3, 100.1, 102.2, 99.9, 101.4,
    ];

    console.log(`Simulating ${marketPredictions.length} market predictions with adaptive coverage...\n`);

    // Trading parameters
    const maxIntervalWidth = 2.0;
    const minConfidenceThreshold = 0.85;
    const positionSizePct = 1.0;

    let trades: Trade[] = [];
    let tradesExecuted = 0;
    let totalPnL = 0.0;
    let correctPredictions = 0;
    let totalPredictions = 0;

    // Process each prediction-actual pair
    for (let i = 0; i < marketPredictions.length; i++) {
        const pred = marketPredictions[i];
        const actual = marketActuals[i];

        // Get prediction interval and adapt coverage based on outcome
        const interval = await predictor.predictAndAdapt(pred, actual);

        // Calculate prediction accuracy
        if (interval.contains(actual)) {
            correctPredictions++;
        }
        totalPredictions++;

        // Check trading criteria
        const widthOk = interval.width() <= maxIntervalWidth;
        const confidenceOk = interval.coverage() >= minConfidenceThreshold;
        const shouldTrade = widthOk && confidenceOk;

        if (shouldTrade) {
            tradesExecuted++;

            // Create trade
            const entry = interval.point;
            const exit = (interval.upper + interval.lower) / 2.0;
            const tradePnL = (exit - entry) * positionSizePct;
            totalPnL += tradePnL;

            // Determine position signal
            const signal = interval.point > actual ? ('SELL' as const) : ('BUY' as const);

            const trade: Trade = {
                id: tradesExecuted,
                signal,
                entryPrice: entry,
                stopLoss: interval.lower,
                takeProfit: interval.upper,
                positionSize: positionSizePct,
                exitPrice: exit,
                pnl: tradePnL,
            };

            trades.push(trade);

            console.log(`Trade #${tradesExecuted} (Iteration ${i + 1})`);
            console.log(`  Signal:              ${signal}`);
            console.log(`  Entry:               ${entry.toFixed(4)}`);
            console.log(`  Actual:              ${actual.toFixed(4)}`);
            console.log(`  Interval:            [${interval.lower.toFixed(4)}, ${interval.upper.toFixed(4)}]`);
            console.log(`  Width:               ${interval.width().toFixed(4)}`);
            console.log(`  Current coverage:    ${(predictor.empiricalCoverage() * 100).toFixed(1)}%`);
            console.log(`  Current alpha:       ${predictor.currentAlpha().toFixed(4)}`);
            console.log(`  Stop Loss:           ${interval.lower.toFixed(4)}`);
            console.log(`  Take Profit:         ${interval.upper.toFixed(4)}`);
            console.log(`  Trade P&L:           ${tradePnL.toFixed(4)}`);
            console.log(`  Cumulative P&L:      ${totalPnL.toFixed(4)}`);
            console.log();
        }
    }

    // Summary statistics
    console.log('\n=== Trading Summary ===\n');
    console.log(`Total predictions:       ${totalPredictions}`);
    console.log(`Prediction accuracy:     ${((correctPredictions / totalPredictions) * 100).toFixed(1)}%`);
    console.log(`Trades executed:         ${tradesExecuted}`);
    console.log(
        `Trade success rate:      ${
            tradesExecuted > 0 ? ((correctPredictions / tradesExecuted) * 100).toFixed(1) : '0.0'
        }%`
    );
    console.log(`Total P&L:               ${totalPnL.toFixed(4)}`);
    console.log(`Average P&L per trade:   ${tradesExecuted > 0 ? (totalPnL / tradesExecuted).toFixed(4) : '0.0000'}`);
    console.log(`Final coverage:          ${(predictor.empiricalCoverage() * 100).toFixed(1)}%`);
    console.log(`Final alpha:             ${predictor.currentAlpha().toFixed(4)}`);

    // Trade analysis
    console.log('\n=== Trade Analysis ===\n');

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const winRate = (winningTrades.length / trades.length) * 100;
    const totalWinPnL = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnL = losingTrades.reduce((sum, t) => sum + t.pnl, 0);

    console.log(`Winning trades:          ${winningTrades.length}`);
    console.log(`Losing trades:           ${losingTrades.length}`);
    console.log(`Win rate:                ${winRate.toFixed(1)}%`);
    console.log(`Total winning P&L:       ${totalWinPnL.toFixed(4)}`);
    console.log(`Total losing P&L:        ${totalLossPnL.toFixed(4)}`);

    if (winningTrades.length > 0) {
        const avgWin = totalWinPnL / winningTrades.length;
        console.log(`Average win:             ${avgWin.toFixed(4)}`);
    }
    if (losingTrades.length > 0) {
        const avgLoss = totalLossPnL / losingTrades.length;
        console.log(`Average loss:            ${avgLoss.toFixed(4)}`);
    }

    // Market regime analysis
    console.log('\n=== Market Regime Analysis ===\n');

    const regimes = [
        { name: 'High volatility (wide intervals)', maxWidth: 3.0 },
        { name: 'Normal conditions (medium intervals)', maxWidth: 1.5 },
        { name: 'Low volatility (narrow intervals)', maxWidth: 0.5 },
    ];

    for (const regime of regimes) {
        let suitableCount = 0;
        for (let i = 0; i < marketPredictions.length; i++) {
            const interval = await predictor.predictAndAdapt(marketPredictions[i], undefined);
            if (interval.width() <= regime.maxWidth && interval.coverage() >= minConfidenceThreshold) {
                suitableCount++;
            }
        }

        console.log(`${regime.name}`);
        console.log(`  Max acceptable width: ${regime.maxWidth.toFixed(2)}`);
        console.log(`  Tradeable opportunities: ${suitableCount}/${totalPredictions}`);
        console.log(`  Trade potential: ${((suitableCount / totalPredictions) * 100).toFixed(1)}%\n`);
    }

    // How adaptive conformal inference works
    console.log('=== How Adaptive Conformal Inference Works ===\n');
    console.log('1. Target coverage is set to 90%');
    console.log('2. For each prediction, actual outcome is observed');
    console.log('3. If empirical coverage diverges from target:');
    console.log('   - Too high coverage → decrease alpha (tighter intervals)');
    console.log('   - Too low coverage → increase alpha (wider intervals)');
    console.log('4. Adjustment uses PID control: α_new = α - γ × (coverage - target)');
    console.log('5. This maintains target coverage as conditions change\n');

    console.log('Key Benefits for Trading:');
    console.log('✓ Intervals adapt to changing market volatility');
    console.log('✓ Maintains coverage guarantees automatically');
    console.log('✓ Identifies tradeable opportunities in real-time');
    console.log('✓ Reduces false signals in choppy markets');
    console.log('✓ No manual recalibration needed\n');

    // Performance metrics
    console.log('=== Performance Metrics ===\n');
    console.log(`Total iterations:        ${totalPredictions}`);
    console.log(`Trades executed:         ${tradesExecuted}`);
    console.log(`Trade execution rate:    ${((tradesExecuted / totalPredictions) * 100).toFixed(1)}%`);
    console.log(`Total P&L:               ${totalPnL.toFixed(4)}`);
    console.log(`ROI:                     ${((totalPnL / (tradesExecuted * positionSizePct)) * 100).toFixed(2)}%`);
    console.log(`Sharpe Ratio (approx):   ${(totalPnL / Math.sqrt(tradesExecuted)).toFixed(4)}`);

    console.log('\n=== Example Complete ===');
}

// Run the example
tradingExample().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
