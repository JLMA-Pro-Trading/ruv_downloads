#!/usr/bin/env python3
"""
Generate coverage reports for the AI News Trading platform
Produces HTML reports and coverage badges
"""

import subprocess
import sys
import os
from pathlib import Path
import json
import xml.etree.ElementTree as ET

def run_coverage_tests(test_type: str, source_dir: str, test_dir: str) -> float:
    """Run coverage tests and return percentage"""
    print(f"\n{'='*60}")
    print(f"Running {test_type} coverage tests...")
    print(f"{'='*60}")
    
    # Clean previous coverage data
    subprocess.run(["coverage", "erase"], capture_output=True)
    
    # Run tests with coverage
    cmd = [
        "coverage", "run",
        "--source", source_dir,
        "--omit", "*/tests/*,*/test_*",
        "-m", "pytest",
        test_dir,
        "-v", "--tb=short"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Warning: Some tests failed for {test_type}")
        print(result.stdout)
        print(result.stderr)
    
    # Generate XML report
    subprocess.run(["coverage", "xml", "-o", f"coverage_{test_type}.xml"], capture_output=True)
    
    # Generate HTML report
    subprocess.run([
        "coverage", "html",
        "-d", f"htmlcov_{test_type}",
        "--title", f"{test_type.title()} Coverage Report"
    ], capture_output=True)
    
    # Get coverage percentage
    result = subprocess.run(["coverage", "report"], capture_output=True, text=True)
    
    # Parse coverage percentage from output
    coverage_pct = 0.0
    for line in result.stdout.split('\n'):
        if 'TOTAL' in line:
            parts = line.split()
            if len(parts) >= 4:
                try:
                    coverage_pct = float(parts[-1].rstrip('%'))
                except:
                    pass
    
    print(f"\n{test_type.title()} Coverage: {coverage_pct}%")
    
    # Also parse from XML for accuracy
    try:
        tree = ET.parse(f"coverage_{test_type}.xml")
        root = tree.getroot()
        coverage_pct = float(root.attrib.get('line-rate', 0)) * 100
    except:
        pass
    
    return coverage_pct

def generate_badge(label: str, percentage: float, output_file: str):
    """Generate coverage badge SVG"""
    # Determine color based on percentage
    if percentage >= 90:
        color = "brightgreen"
    elif percentage >= 80:
        color = "green"
    elif percentage >= 70:
        color = "yellowgreen"
    elif percentage >= 60:
        color = "yellow"
    elif percentage >= 50:
        color = "orange"
    else:
        color = "red"
    
    # Create badge SVG
    badge_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="114" height="20">
    <linearGradient id="b" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <mask id="a">
        <rect width="114" height="20" rx="3" fill="#fff"/>
    </mask>
    <g mask="url(#a)">
        <path fill="#555" d="M0 0h63v20H0z"/>
        <path fill="{color}" d="M63 0h51v20H63z"/>
        <path fill="url(#b)" d="M0 0h114v20H0z"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
        <text x="31.5" y="15" fill="#010101" fill-opacity=".3">{label}</text>
        <text x="31.5" y="14">{label}</text>
        <text x="87.5" y="15" fill="#010101" fill-opacity=".3">{percentage:.1f}%</text>
        <text x="87.5" y="14">{percentage:.1f}%</text>
    </g>
</svg>"""
    
    with open(output_file, 'w') as f:
        f.write(badge_svg)
    
    print(f"Generated badge: {output_file}")

def generate_coverage_summary():
    """Generate overall coverage summary"""
    print("\n" + "="*60)
    print("COVERAGE SUMMARY")
    print("="*60)
    
    # Define test configurations
    test_configs = [
        {
            "name": "unit",
            "source": "src",
            "test_dir": "tests/unit",
            "target": 95.0
        },
        {
            "name": "integration",
            "source": "src",
            "test_dir": "tests/integration", 
            "target": 85.0
        },
        {
            "name": "mcp",
            "source": "src/mcp",
            "test_dir": "tests/integration/test_mcp_integration.py",
            "target": 90.0
        },
        {
            "name": "news",
            "source": "src/integrations",
            "test_dir": "tests/broker_integration/unit/news",
            "target": 95.0
        }
    ]
    
    results = {}
    
    # Run coverage for each test type
    for config in test_configs:
        if Path(config["test_dir"]).exists():
            coverage_pct = run_coverage_tests(
                config["name"],
                config["source"],
                config["test_dir"]
            )
            results[config["name"]] = {
                "percentage": coverage_pct,
                "target": config["target"],
                "passed": coverage_pct >= config["target"]
            }
            
            # Generate badge
            generate_badge(
                f"{config['name']} coverage",
                coverage_pct,
                f"coverage_badge_{config['name']}.svg"
            )
        else:
            print(f"\nSkipping {config['name']} tests - directory not found: {config['test_dir']}")
    
    # Generate combined coverage report
    print("\n" + "="*60)
    print("FINAL COVERAGE REPORT")
    print("="*60)
    
    all_passed = True
    for test_type, result in results.items():
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{test_type.upper():12} {result['percentage']:6.2f}% / {result['target']:6.2f}% {status}")
        if not result["passed"]:
            all_passed = False
    
    # Generate overall badge
    if results:
        avg_coverage = sum(r["percentage"] for r in results.values()) / len(results)
        generate_badge("coverage", avg_coverage, "coverage_badge_overall.svg")
    
    # Save results to JSON
    with open("coverage_report.json", "w") as f:
        json.dump({
            "results": results,
            "timestamp": str(Path("coverage_report.json").stat().st_mtime if Path("coverage_report.json").exists() else ""),
            "all_passed": all_passed
        }, f, indent=2)
    
    print("\n" + "="*60)
    if all_passed:
        print("🎉 All coverage targets met!")
    else:
        print("⚠️  Some coverage targets not met")
    print("="*60)
    
    return all_passed

def main():
    """Main entry point"""
    # Change to project root
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)
    
    # Check if required tools are installed
    required_tools = ["coverage", "pytest"]
    for tool in required_tools:
        result = subprocess.run(["which", tool], capture_output=True)
        if result.returncode != 0:
            print(f"Error: {tool} not found. Please install it first.")
            print(f"Run: pip install {tool}")
            sys.exit(1)
    
    # Generate coverage reports
    all_passed = generate_coverage_summary()
    
    # Create coverage directory for reports
    coverage_dir = Path("coverage_reports")
    coverage_dir.mkdir(exist_ok=True)
    
    # Move all coverage files to the directory
    for file in Path(".").glob("coverage*"):
        if file.is_file():
            file.rename(coverage_dir / file.name)
    
    for dir in Path(".").glob("htmlcov*"):
        if dir.is_dir():
            dir.rename(coverage_dir / dir.name)
    
    print(f"\nCoverage reports saved to: {coverage_dir.absolute()}")
    print("\nView HTML reports:")
    for htmldir in coverage_dir.glob("htmlcov*"):
        print(f"  open {htmldir}/index.html")
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()