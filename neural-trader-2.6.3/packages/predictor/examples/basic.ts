/**
 * Basic Conformal Prediction Example
 *
 * This example demonstrates fundamental conformal prediction usage to create
 * prediction intervals with statistical guarantees using TypeScript.
 */

import {
    ConformalPredictor,
    AbsoluteScore,
    NormalizedScore,
} from '../src/index';

async function basicExample() {
    console.log('=== Basic Conformal Prediction Example (TypeScript) ===\n');

    // Create a conformal predictor with 90% coverage (alpha = 0.1)
    const predictor = new ConformalPredictor({
        alpha: 0.1,
        scoreFunction: new AbsoluteScore(),
    });

    // Step 1: Prepare calibration data
    console.log('Step 1: Preparing calibration data...');
    const modelPredictions = [100.0, 105.0, 98.0, 102.0, 101.0, 99.5, 103.5, 100.5, 102.5, 101.5];
    const actualValues = [102.0, 104.0, 99.0, 101.0, 100.5, 98.5, 104.0, 101.0, 102.0, 100.5];

    console.log(`  Model predictions: [${modelPredictions.join(', ')}]`);
    console.log(`  Actual values:     [${actualValues.join(', ')}]\n`);

    // Step 2: Calibrate the predictor
    console.log('Step 2: Calibrating predictor...');
    await predictor.calibrate(modelPredictions, actualValues);
    console.log('  ✓ Calibration complete\n');

    // Step 3: Make predictions with intervals
    console.log('Step 3: Making predictions with guaranteed intervals...\n');

    const testPredictions = [100.5, 102.0, 101.5, 103.0, 99.0];

    for (let i = 0; i < testPredictions.length; i++) {
        const pred = testPredictions[i];
        const interval = predictor.predict(pred);

        console.log(`  Prediction ${i + 1}`);
        console.log(`    Point estimate:           ${interval.point}`);
        console.log(`    90% confidence interval:  [${interval.lower.toFixed(4)}, ${interval.upper.toFixed(4)}]`);
        console.log(`    Interval width:           ${interval.width().toFixed(4)}`);
        console.log(`    Relative width:           ${interval.relativeWidth().toFixed(2)}%`);
        console.log(`    Coverage guarantee:       ${(interval.coverage() * 100).toFixed(0)}%`);

        // Check containment
        const midpoint = (interval.lower + interval.upper) / 2;
        console.log(`    Contains midpoint (${midpoint.toFixed(4)}): ${interval.contains(midpoint)}`);
        console.log();
    }

    // Step 4: Update predictor with new observations
    console.log('Step 4: Updating predictor with new observations...');
    const newPred = 100.5;
    const newActual = 100.2;

    await predictor.update(newPred, newActual);
    console.log(`  ✓ Updated with prediction: ${newPred}, actual: ${newActual}\n`);

    // Step 5: Prediction with updated calibration
    console.log('Step 5: Prediction with updated calibration...');
    const finalPred = 102.0;
    const finalInterval = predictor.predict(finalPred);

    console.log(`  New prediction for ${finalPred}:`);
    console.log(`    Interval: [${finalInterval.lower.toFixed(4)}, ${finalInterval.upper.toFixed(4)}]`);
    console.log(`    Width: ${finalInterval.width().toFixed(4)}\n`);

    // Step 6: Different score functions
    console.log('Step 6: Comparing different score functions...\n');

    const predictor2 = new ConformalPredictor({
        alpha: 0.1,
        scoreFunction: new NormalizedScore({ epsilon: 1e-6 }),
    });

    await predictor2.calibrate(modelPredictions, actualValues);

    const interval1 = predictor.predict(102.0);
    const interval2 = predictor2.predict(102.0);

    console.log('  Absolute Score:');
    console.log(`    Interval: [${interval1.lower.toFixed(4)}, ${interval1.upper.toFixed(4)}]`);
    console.log(`    Width: ${interval1.width().toFixed(4)}\n`);

    console.log('  Normalized Score:');
    console.log(`    Interval: [${interval2.lower.toFixed(4)}, ${interval2.upper.toFixed(4)}]`);
    console.log(`    Width: ${interval2.width().toFixed(4)}\n`);

    // Practical application: Investment decision
    console.log('=== Practical Application: Investment Decision ===\n');

    const maxAcceptableWidth = 2.0;
    const minAcceptableConfidence = 0.85;

    console.log('Investment criteria:');
    console.log(`  Max acceptable interval width: ${maxAcceptableWidth}`);
    console.log(`  Min acceptable confidence: ${minAcceptableConfidence * 100}%\n`);

    for (let i = 0; i < testPredictions.length; i++) {
        const pred = testPredictions[i];
        const interval = predictor.predict(pred);
        const widthAcceptable = interval.width() <= maxAcceptableWidth;
        const confidenceAcceptable = interval.coverage() >= minAcceptableConfidence;
        const shouldInvest = widthAcceptable && confidenceAcceptable;

        console.log(`  Opportunity ${i + 1}`);
        console.log(`    Price range: [${interval.lower.toFixed(2)}, ${interval.upper.toFixed(2)}]`);
        console.log(
            `    Width: ${interval.width().toFixed(2)} - ${widthAcceptable ? '✓ OK' : '✗ Too wide'}`
        );
        console.log(
            `    Confidence: ${(interval.coverage() * 100).toFixed(0)}% - ${
                confidenceAcceptable ? '✓ OK' : '✗ Too low'
            }`
        );
        console.log(`    Investment signal: ${shouldInvest ? '✓ PROCEED' : '✗ SKIP'}`);
        console.log();
    }

    console.log('=== Example Complete ===\n');
    console.log('Key Takeaways:');
    console.log('1. Conformal prediction provides intervals with statistical guarantees');
    console.log('2. Interval width reflects model uncertainty');
    console.log('3. Different score functions capture different types of prediction error');
    console.log('4. Calibration is crucial for achieving target coverage');
    console.log('5. Intervals can inform investment and trading decisions');
}

// Run the example
basicExample().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
