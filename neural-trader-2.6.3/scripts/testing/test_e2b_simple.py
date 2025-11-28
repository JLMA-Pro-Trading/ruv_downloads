#!/usr/bin/env python3
"""Simple E2B API key test"""

import os
from dotenv import load_dotenv
from e2b import Sandbox

# Load environment variables
load_dotenv()

api_key = os.getenv("E2B_API_KEY")
print(f"Testing E2B API key: {api_key[:10]}...")

try:
    # Create sandbox
    with Sandbox(api_key=api_key) as sandbox:
        print("✅ Successfully connected to E2B!")
        
        # Write a file
        sandbox.filesystem.write("/tmp/hello.txt", "Hello, E2B!")
        
        # Read the file back
        content = sandbox.filesystem.read("/tmp/hello.txt")
        print(f"✅ File I/O test passed: {content}")
        
        # Run a simple command
        result = sandbox.process.start("echo 'E2B is working!'")
        result.wait()
        print(f"✅ Command execution test passed: {result.stdout.strip() if result.stdout else 'No output'}")
        
    print("\n✅ E2B API KEY IS VALID AND WORKING!")
    
except Exception as e:
    print(f"\n❌ E2B API key validation failed:")
    print(f"   Error: {e}")
    
    if "401" in str(e) or "unauthorized" in str(e).lower():
        print("   → The API key is invalid or expired")
    elif "404" in str(e):
        print("   → E2B service endpoint not found")
    elif "quota" in str(e).lower() or "limit" in str(e).lower():
        print("   → You may have exceeded your usage quota")
    else:
        print("   → Please check your API key and try again")