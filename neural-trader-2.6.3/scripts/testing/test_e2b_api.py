#!/usr/bin/env python3
"""Test E2B API key functionality"""

import os
import sys
from dotenv import load_dotenv
from e2b import Sandbox, ApiClient

# Load environment variables
load_dotenv()

def test_e2b_api_key():
    """Test if the E2B API key is valid and working"""
    
    api_key = os.getenv("E2B_API_KEY")
    
    if not api_key:
        print("❌ E2B_API_KEY not found in environment variables")
        return False
    
    print(f"✅ E2B_API_KEY found: {api_key[:10]}...")
    
    try:
        # Try to create a sandbox to test the API key
        print("🔄 Testing API key by creating a sandbox...")
        
        # Create a sandbox with the API key
        sandbox = Sandbox(api_key=api_key)
        print(f"✅ Sandbox created successfully!")
        print(f"   Sandbox ID: {sandbox.id}")
        
        # Test filesystem operations
        print("\n🔄 Testing filesystem operations...")
        sandbox.filesystem.write("/tmp/test.txt", "E2B API key is working!")
        content = sandbox.filesystem.read("/tmp/test.txt")
        print(f"✅ File operations working!")
        print(f"   Test file content: {content}")
        
        # Test process execution
        print("\n🔄 Testing process execution...")
        proc = sandbox.process.start("echo 'Hello from E2B sandbox!'")
        proc.wait()
        output = proc.stdout if proc.stdout else ""
        print(f"✅ Process execution working!")
        print(f"   Process output: {output.strip()}")
        
        # Test Python execution
        print("\n🔄 Testing Python execution...")
        sandbox.filesystem.write("/tmp/test.py", """
import sys
print(f"Python {sys.version.split()[0]} is working in E2B!")
print("API key validated successfully!")
""")
        proc = sandbox.process.start("python /tmp/test.py")
        proc.wait()
        print(f"✅ Python execution working!")
        if proc.stdout:
            for line in proc.stdout.strip().split('\n'):
                print(f"   {line}")
        
        # Clean up
        sandbox.close()
        print("\n✅ Sandbox closed successfully")
        
        print("\n✅ E2B API key is VALID and WORKING!")
        return True
        
    except Exception as e:
        print(f"\n❌ Failed to authenticate with E2B API")
        print(f"   Error: {str(e)}")
        
        if "401" in str(e) or "unauthorized" in str(e).lower():
            print("   → The API key appears to be invalid or expired")
        elif "quota" in str(e).lower():
            print("   → You may have exceeded your usage quota")
        else:
            print("   → Check your internet connection and E2B service status")
        
        return False

if __name__ == "__main__":
    success = test_e2b_api_key()
    sys.exit(0 if success else 1)