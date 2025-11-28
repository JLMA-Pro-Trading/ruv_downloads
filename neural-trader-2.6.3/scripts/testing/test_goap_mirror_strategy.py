#!/usr/bin/env python3
"""
Test script for GOAP-Enhanced Mirror Trading Strategy
Validates the enhanced strategy against the neural-trader MCP system
"""

import sys
import os
import json
import asyncio
from datetime import datetime, timedelta
import logging

# Add src to path
sys.path.append('/workspaces/neural-trader/src')

from strategies.goap_mirror_trading_enhanced import GOAPMirrorTradingStrategy

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class StrategyTester:
    """Test the GOAP mirror trading strategy"""

    def __init__(self):
        self.strategy = GOAPMirrorTradingStrategy()
        self.test_results = []

    def simulate_market_data(self, scenario: str) -> dict:
        """Generate simulated market data for different scenarios"""
        scenarios = {
            'bull_market_strong_signal': {
                'trend_strength': 0.6,
                'vix': 15,
                'institutional_flow': 0.8,
                'insider_activity': 0.5,
                'intraday_signal': 0.9,
                'daily_signal': 0.85,
                'weekly_signal': 0.8,
                'monthly_signal': 0.7
            },
            'bear_market_high_correlation': {
                'trend_strength': -0.5,
                'vix': 30,
                'institutional_flow': -0.6,
                'insider_activity': -0.3,
                'intraday_signal': 0.3,
                'daily_signal': 0.4,
                'weekly_signal': 0.6,
                'monthly_signal': 0.5
            },
            'sideways_market_mixed_signals': {
                'trend_strength': 0.1,
                'vix': 20,
                'institutional_flow': 0.2,
                'insider_activity': -0.1,
                'intraday_signal': 0.6,
                'daily_signal': 0.5,
                'weekly_signal': 0.4,
                'monthly_signal': 0.7
            },
            'high_volatility_defensive': {
                'trend_strength': -0.2,
                'vix': 35,
                'institutional_flow': -0.4,
                'insider_activity': 0.2,
                'intraday_signal': 0.4,
                'daily_signal': 0.3,
                'weekly_signal': 0.5,
                'monthly_signal': 0.6
            }
        }
        return scenarios.get(scenario, scenarios['sideways_market_mixed_signals'])

    def simulate_portfolio_data(self, scenario: str) -> dict:
        """Generate simulated portfolio data"""
        base_portfolio = {
            'value': 999864,
            'cash_ratio': 0.954,
            'position_count': 8,
        }

        if scenario == 'bear_market_high_correlation':
            base_portfolio['correlation_risk'] = 0.75  # High correlation
        elif scenario == 'bull_market_strong_signal':
            base_portfolio['correlation_risk'] = 0.3   # Low correlation
        else:
            base_portfolio['correlation_risk'] = 0.491  # Current level

        return base_portfolio

    def test_scenario(self, scenario_name: str):
        """Test a specific market scenario"""
        logger.info(f"Testing scenario: {scenario_name}")

        # Get simulated data
        market_data = self.simulate_market_data(scenario_name)
        portfolio_data = self.simulate_portfolio_data(scenario_name)

        # Execute strategy
        results = self.strategy.execute_strategy(market_data, portfolio_data)

        # Analyze results
        analysis = self.analyze_results(scenario_name, results, market_data, portfolio_data)

        self.test_results.append(analysis)
        return analysis

    def analyze_results(self, scenario: str, results: dict, market_data: dict, portfolio_data: dict) -> dict:
        """Analyze strategy execution results"""
        analysis = {
            'scenario': scenario,
            'timestamp': datetime.now().isoformat(),
            'market_conditions': {
                'regime': results['state_assessment']['market_regime'],
                'signal_strength': results['state_assessment']['signal_strength'],
                'correlation_risk': results['state_assessment']['correlation_risk']
            },
            'strategy_response': {
                'planned_actions': results['planned_actions'],
                'recommended_action': results['state_assessment']['recommended_action'],
                'adaptive_parameters': results['adaptive_parameters']
            },
            'performance_assessment': self.assess_strategy_appropriateness(scenario, results)
        }

        return analysis

    def assess_strategy_appropriateness(self, scenario: str, results: dict) -> dict:
        """Assess if strategy response is appropriate for scenario"""
        assessment = {'score': 0, 'rationale': []}

        planned_actions = results['planned_actions']
        recommended_action = results['state_assessment']['recommended_action']
        adaptive_params = results['adaptive_parameters']

        # Score based on scenario appropriateness
        if scenario == 'bull_market_strong_signal':
            if 'execute_mirror_trade' in planned_actions:
                assessment['score'] += 30
                assessment['rationale'].append("Correctly planned trade execution for strong signal")

            if adaptive_params['confidence_threshold'] <= 0.75:
                assessment['score'] += 20
                assessment['rationale'].append("Appropriately aggressive threshold for bull market")

        elif scenario == 'bear_market_high_correlation':
            if 'adjust_correlations' in planned_actions:
                assessment['score'] += 40
                assessment['rationale'].append("Correctly prioritized correlation adjustment")

            if adaptive_params['confidence_threshold'] > 0.8:
                assessment['score'] += 20
                assessment['rationale'].append("Appropriately conservative in bear market")

        elif scenario == 'high_volatility_defensive':
            if adaptive_params['stop_loss_base'] > -0.06:
                assessment['score'] += 25
                assessment['rationale'].append("Tightened stop losses for high volatility")

            if adaptive_params['base_position_size'] < 0.02:
                assessment['score'] += 25
                assessment['rationale'].append("Reduced position sizes for volatility")

        # General scoring
        if 'dynamic_stop_loss' in planned_actions:
            assessment['score'] += 10
            assessment['rationale'].append("Included dynamic risk management")

        return assessment

    def run_comprehensive_test(self):
        """Run tests across all scenarios"""
        scenarios = [
            'bull_market_strong_signal',
            'bear_market_high_correlation',
            'sideways_market_mixed_signals',
            'high_volatility_defensive'
        ]

        logger.info("Starting comprehensive GOAP mirror trading strategy test")

        for scenario in scenarios:
            try:
                result = self.test_scenario(scenario)
                logger.info(f"Scenario {scenario}: Score {result['performance_assessment']['score']}/100")
            except Exception as e:
                logger.error(f"Error testing scenario {scenario}: {e}")

        # Generate summary report
        self.generate_summary_report()

    def generate_summary_report(self):
        """Generate comprehensive test summary"""
        if not self.test_results:
            logger.warning("No test results to summarize")
            return

        total_score = sum(result['performance_assessment']['score'] for result in self.test_results)
        average_score = total_score / len(self.test_results)

        report = {
            'test_summary': {
                'total_scenarios_tested': len(self.test_results),
                'average_performance_score': average_score,
                'test_timestamp': datetime.now().isoformat()
            },
            'scenario_results': self.test_results,
            'recommendations': self.generate_recommendations(average_score)
        }

        # Save report
        report_path = '/workspaces/neural-trader/reports/goap_strategy_test_report.json'
        os.makedirs(os.path.dirname(report_path), exist_ok=True)

        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        logger.info(f"Test report saved to: {report_path}")
        logger.info(f"Overall strategy performance score: {average_score:.1f}/100")

        return report

    def generate_recommendations(self, average_score: float) -> list:
        """Generate recommendations based on test results"""
        recommendations = []

        if average_score >= 80:
            recommendations.append("Strategy shows excellent adaptability across market conditions")
            recommendations.append("Ready for live paper trading deployment")
        elif average_score >= 60:
            recommendations.append("Strategy shows good adaptability with some improvement opportunities")
            recommendations.append("Consider parameter fine-tuning before deployment")
        else:
            recommendations.append("Strategy needs significant improvement before deployment")
            recommendations.append("Review action sequences and adaptive parameters")

        # Specific recommendations based on individual scenario performance
        for result in self.test_results:
            score = result['performance_assessment']['score']
            scenario = result['scenario']

            if score < 50:
                recommendations.append(f"Poor performance in {scenario} - review strategy logic")

        return recommendations

def main():
    """Main test execution"""
    tester = StrategyTester()

    try:
        # Run comprehensive test
        tester.run_comprehensive_test()

        # Print summary
        if tester.test_results:
            print("\n" + "="*60)
            print("GOAP Mirror Trading Strategy Test Summary")
            print("="*60)

            for result in tester.test_results:
                scenario = result['scenario']
                score = result['performance_assessment']['score']
                actions = ', '.join(result['strategy_response']['planned_actions'][:3])

                print(f"\n{scenario.replace('_', ' ').title()}:")
                print(f"  Score: {score}/100")
                print(f"  Top Actions: {actions}")
                print(f"  Market Regime: {result['market_conditions']['regime']}")

            avg_score = sum(r['performance_assessment']['score'] for r in tester.test_results) / len(tester.test_results)
            print(f"\nOverall Average Score: {avg_score:.1f}/100")

    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        return 1

    return 0

if __name__ == "__main__":
    exit(main())